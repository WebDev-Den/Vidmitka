import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { definitions, normalizeName, type ScheduleSnapshot, type TransferData, type TransferRow } from "./schema";
import { planSnapshot, type TransferPlan } from "./plan";

// All identifiers / expressions below are generated from the static registry, never file keys.
const selectData = `SELECT jsonb_build_object(${Object.entries(definitions).map(([section, def]) => {
  const columns = Object.entries(def.fields).map(([name, field]) => {
    const expression = name === "period_number"
      ? "(SELECT number FROM class_periods WHERE id=t.class_period_id)"
      : `t.${name}${["date", "time", "uuid"].includes(field.type) ? "::text" : ""}`;
    return `'${name}', ${expression}`;
  });
  for (const [name, link] of Object.entries(def.links ?? {})) columns.push(`'${name}',
    COALESCE((SELECT jsonb_agg(${link.column}::text ORDER BY ${link.column}) FROM ${link.table} WHERE ${link.parent}=t.id), '[]'::jsonb)`);
  return `'${section}', COALESCE((SELECT jsonb_agg(jsonb_build_object(${columns.join(",")}) ORDER BY t.${def.key}) FROM ${def.table} t), '[]'::jsonb)`;
}).join(",")}) AS data`;

export async function readTransferState(): Promise<{ data: TransferData; journalDates: string[] }> {
  const sql = getDb();
  const [dataRows, journalRows] = await sql.transaction([
    sql.query(selectData), sql`SELECT DISTINCT held_on::text AS date FROM attendance_sessions ORDER BY date`,
  ], { isolationLevel: "RepeatableRead", readOnly: true });
  return {
    data: (dataRows as unknown as { data: TransferData }[])[0].data,
    journalDates: (journalRows as unknown as { date: string }[]).map((row) => row.date),
  };
}

export async function exportScheduleSnapshot(): Promise<ScheduleSnapshot> {
  const { data } = await readTransferState();
  return { format: "vidmitka-schedule", version: 1, exportedAt: new Date().toISOString(), data };
}

// Sort object keys and rows for a transport-independent preview fingerprint.
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).sort().join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
export function transferFingerprint(data: unknown): string {
  return createHash("sha256").update(stable(data)).digest("hex");
}

export async function previewSnapshot(snapshot: ScheduleSnapshot) {
  const current = await readTransferState();
  return { ...current, plan: planSnapshot(snapshot.data, current.data, current.journalDates), fingerprint: transferFingerprint(current) };
}

function rowQuery(section: string, row: TransferRow, administratorId: string) {
  const def = definitions[section], sql = getDb();
  const payload: TransferRow = { ...row };
  const columns: string[] = [], expressions: string[] = [];
  for (const [name, field] of Object.entries(def.fields)) {
    columns.push(name === "period_number" ? "class_period_id" : name);
    expressions.push(name === "period_number" ? `(SELECT id FROM class_periods WHERE number=(j->>'${name}')::integer)` : `(j->>'${name}')::${field.type}`);
    if (field.normalized) {
      columns.push(field.normalized); expressions.push(`j->>'${field.normalized}'`);
      payload[field.normalized] = normalizeName(row[name]);
    }
  }
  if (def.actor) {
    columns.push("created_by_user_id", "updated_by_user_id"); expressions.push("$2::text", "$2::text");
  }
  const updates = columns.filter((column) => column !== def.key && column !== "created_by_user_id")
    .map((column) => `${column}=EXCLUDED.${column}`);
  if (section === "calendar") updates.push("version=makeup_days.version+1");
  updates.push("updated_at=NOW()");
  return sql.query(`INSERT INTO ${def.table} (${columns.join(",")})
    SELECT ${expressions.join(",")} FROM (SELECT $1::jsonb AS j) payload WHERE TRUE
    ON CONFLICT (${def.key}) DO UPDATE SET ${updates.join(",")}`,
  def.actor ? [JSON.stringify(payload), administratorId] : [JSON.stringify(payload)]);
}

export class StaleTransferError extends Error {}

/** Single all-or-nothing write. No DELETE of top-level records; only replace included memberships. */
export async function commitSnapshot(input: {
  snapshot: ScheduleSnapshot; expectedFingerprint: string; administratorId: string;
  fileName: string; fileHash: string; fileSize: number; confirmWarnings: boolean;
}): Promise<{ runId: string; plan: TransferPlan }> {
  const preview = await previewSnapshot(input.snapshot);
  if (preview.fingerprint !== input.expectedFingerprint) throw new StaleTransferError("Розклад змінився після dry-run. Перевірте файл повторно.");
  if (preview.plan.errors.length) throw new Error("Імпорт має помилки. Виконайте dry-run повторно.");
  if (preview.plan.warnings.length && !input.confirmWarnings) throw new Error("Підтвердьте попередження dry-run.");
  const sql = getDb(), runId = randomUUID();
  const tables = [...Object.values(definitions).flatMap((def) => [def.table, ...Object.values(def.links ?? {}).map((link) => link.table)]), "attendance_sessions"];
  const queries = [
    sql`SET LOCAL lock_timeout = '5s'`,
    sql.query(`LOCK TABLE ${tables.join(",")} IN SHARE ROW EXCLUSIVE MODE`),
    sql`CREATE TEMP TABLE vidmitka_transfer_guard (valid boolean NOT NULL CHECK (valid)) ON COMMIT DROP`,
    sql.query(`INSERT INTO vidmitka_transfer_guard SELECT data=$1::jsonb FROM (${selectData}) snapshot`, [JSON.stringify(preview.data)]),
    sql`INSERT INTO vidmitka_transfer_guard SELECT EXISTS (SELECT 1 FROM app_users WHERE id=${input.administratorId} AND role='administrator' AND approval_status='approved')`,
    // The attendance table is locked too: a new journal cannot slip between preview and calendar writes.
    sql`INSERT INTO vidmitka_transfer_guard SELECT NOT EXISTS (SELECT 1 FROM attendance_sessions
      WHERE held_on::text IN (SELECT value FROM jsonb_array_elements_text(${JSON.stringify(preview.plan.changed.calendar.map((row) => row.held_on))}::jsonb)))`,
  ];
  // Temporarily disable only changing periods inside this transaction, allowing simultaneous time swaps.
  if (preview.plan.changed.periods.length) queries.push(sql`UPDATE class_periods SET is_active=FALSE
    WHERE number IN (SELECT value::integer FROM jsonb_array_elements_text(${JSON.stringify(preview.plan.changed.periods.map((row) => row.number))}::jsonb))`);
  for (const [section, def] of Object.entries(definitions)) {
    for (const row of preview.plan.changed[section]) {
      queries.push(rowQuery(section, row, input.administratorId));
      for (const [field, link] of Object.entries(def.links ?? {})) {
        queries.push(sql.query(`DELETE FROM ${link.table} WHERE ${link.parent}=$1::uuid`, [row.id]));
        queries.push(sql.query(`INSERT INTO ${link.table} (${link.parent}, ${link.column})
          SELECT $1::uuid, value::uuid FROM jsonb_array_elements_text($2::jsonb)`, [row.id, JSON.stringify(row[field])]));
      }
    }
  }
  const totals = preview.plan.counts.reduce((sum, row) => ({ created: sum.created + row.created,
    updated: sum.updated + row.updated, unchanged: sum.unchanged + row.unchanged }), { created: 0, updated: 0, unchanged: 0 });
  queries.push(sql`INSERT INTO schedule_import_runs (id, file_name, file_hash, file_size_bytes, status,
    total_count, created_count, updated_count, skipped_count, warning_count, created_by_user_id, completed_at)
    VALUES (${runId}, ${input.fileName}, ${input.fileHash}, ${input.fileSize}, 'committed',
      ${totals.created + totals.updated + totals.unchanged}, ${totals.created}, ${totals.updated}, ${totals.unchanged},
      ${preview.plan.warnings.length}, ${input.administratorId}, NOW())`);
  try {
    await sql.transaction(queries, { isolationLevel: "ReadCommitted" });
  } catch (error) {
    if ((error as { code?: string; table?: string }).table === "vidmitka_transfer_guard") {
      throw new StaleTransferError("Дані або права змінилися. Виконайте dry-run повторно.");
    }
    throw error;
  }
  return { runId, plan: preview.plan };
}
