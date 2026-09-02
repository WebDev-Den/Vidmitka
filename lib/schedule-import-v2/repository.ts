import "server-only";

import { randomUUID } from "node:crypto";

import { getDb } from "@/lib/db";

import type { TeacherScheduleImportRow } from "./parser";

const SOURCE_KIND = "teacher_schedule_json";

export type ImportDatabasePreview = Readonly<{
  createCount: number;
  updateCount: number;
  skipCount: number;
  missingPeriods: readonly number[];
  newCatalogs: Readonly<{ teachers: number; disciplines: number; rooms: number; groups: number; lessonTypes: number }>;
}>;

export type ImportCommitResult = Readonly<{
  runId: string;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
}>;

type ExistingSourceRow = {
  source_id: string;
  source_payload_hash: string | null;
  source_type: "entry" | "exception";
};

function key(value: string): string {
  return value.normalize("NFC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("uk-UA");
}

function serializedRows(rows: readonly TeacherScheduleImportRow[]): string {
  return JSON.stringify(rows.map((row) => ({
    row_number: row.rowNumber,
    source_id: row.sourceId,
    payload_hash: row.payloadHash,
    teacher_name: row.teacherName,
    teacher_key: key(row.teacherName),
    valid_from: row.validFrom,
    valid_until: row.validUntil,
    day_of_week: row.dayOfWeek,
    period_number: row.periodNumber,
    week_pattern: row.weekPattern,
    discipline_name: row.disciplineName,
    discipline_key: key(row.disciplineName),
    room_name: row.roomName,
    room_key: key(row.roomName),
    group_items: row.groups.map((name) => ({ name, key: key(name) })),
    lesson_type_name: row.lessonTypeName,
    lesson_type_key: key(row.lessonTypeName),
    source_schedule_day: row.sourceScheduleDay,
    source_schedule_week: row.sourceScheduleWeek,
  })));
}

export async function previewTeacherScheduleImport(
  rows: readonly TeacherScheduleImportRow[],
): Promise<ImportDatabasePreview> {
  if (rows.length === 0) return { createCount: 0, updateCount: 0, skipCount: 0, missingPeriods: [],
    newCatalogs: { teachers: 0, disciplines: 0, rooms: 0, groups: 0, lessonTypes: 0 } };
  const sql = getDb();
  const sourceIds = rows.map((row) => row.sourceId);
  const periodNumbers = [...new Set(rows.map((row) => row.periodNumber))];
  const sourceIdsJson = JSON.stringify(sourceIds);
  const periodNumbersJson = JSON.stringify(periodNumbers);
  const teachersJson=JSON.stringify([...new Set(rows.map((row)=>key(row.teacherName)))]);
  const disciplinesJson=JSON.stringify([...new Set(rows.map((row)=>key(row.disciplineName)))]);
  const roomsJson=JSON.stringify([...new Set(rows.map((row)=>key(row.roomName)))]);
  const groupsJson=JSON.stringify([...new Set(rows.flatMap((row)=>row.groups.map(key)))]);
  const lessonTypesJson=JSON.stringify([...new Set(rows.map((row)=>key(row.lessonTypeName)))]);
  const [existing, periods, catalogs] = await Promise.all([
    sql`
      SELECT DISTINCT ON (source_id) source_id, source_payload_hash, source_type
      FROM (
        SELECT source_id, source_payload_hash, 'entry'::TEXT AS source_type, 0 AS priority
        FROM schedule_entries
        WHERE source_kind = ${SOURCE_KIND} AND source_id IN
          (SELECT value FROM JSONB_ARRAY_ELEMENTS_TEXT(${sourceIdsJson}::JSONB))
        UNION ALL
        SELECT source_id, source_payload_hash, 'exception'::TEXT AS source_type, 1 AS priority
        FROM schedule_exceptions
        WHERE source_kind = ${SOURCE_KIND} AND status='active' AND source_id IN
          (SELECT value FROM JSONB_ARRAY_ELEMENTS_TEXT(${sourceIdsJson}::JSONB))
      ) sources
      ORDER BY source_id, priority
    ` as unknown as Promise<ExistingSourceRow[]>,
    sql`
      SELECT number FROM class_periods
      WHERE is_active = TRUE AND number IN
        (SELECT value::SMALLINT FROM JSONB_ARRAY_ELEMENTS_TEXT(${periodNumbersJson}::JSONB))
    ` as unknown as Promise<Array<{ number: number }>>,
    sql`SELECT
      (SELECT COUNT(*) FROM JSONB_ARRAY_ELEMENTS_TEXT(${teachersJson}::JSONB) AS item(value)
        WHERE NOT EXISTS (SELECT 1 FROM teachers WHERE display_name_normalized=item.value)) AS teachers,
      (SELECT COUNT(*) FROM JSONB_ARRAY_ELEMENTS_TEXT(${disciplinesJson}::JSONB) AS item(value)
        WHERE NOT EXISTS (SELECT 1 FROM disciplines WHERE name_normalized=item.value)) AS disciplines,
      (SELECT COUNT(*) FROM JSONB_ARRAY_ELEMENTS_TEXT(${roomsJson}::JSONB) AS item(value)
        WHERE NOT EXISTS (SELECT 1 FROM schedule_rooms WHERE name_normalized=item.value)) AS rooms,
      (SELECT COUNT(*) FROM JSONB_ARRAY_ELEMENTS_TEXT(${groupsJson}::JSONB) AS item(value)
        WHERE NOT EXISTS (SELECT 1 FROM academic_groups WHERE code_normalized=item.value)) AS groups,
      (SELECT COUNT(*) FROM JSONB_ARRAY_ELEMENTS_TEXT(${lessonTypesJson}::JSONB) AS item(value)
        WHERE NOT EXISTS (SELECT 1 FROM schedule_lesson_types WHERE name_normalized=item.value)) AS lesson_types
    ` as unknown as Promise<Array<{teachers:number;disciplines:number;rooms:number;groups:number;lesson_types:number}>>,
  ]);
  const bySource = new Map(existing.map((row) => [row.source_id, row]));
  const activePeriods = new Set(periods.map((row) => Number(row.number)));

  let createCount = 0;
  let updateCount = 0;
  let skipCount = 0;
  for (const row of rows) {
    const existingRow = bySource.get(row.sourceId);
    if (existingRow === undefined) createCount += 1;
    else if (existingRow.source_type === "entry" && existingRow.source_payload_hash === row.payloadHash) skipCount += 1;
    else updateCount += 1;
  }

  return {
    createCount,
    updateCount,
    skipCount,
    missingPeriods: periodNumbers.filter((number) => !activePeriods.has(number)).sort((a, b) => a - b),
    newCatalogs: { teachers:Number(catalogs[0]?.teachers ?? 0), disciplines:Number(catalogs[0]?.disciplines ?? 0),
      rooms:Number(catalogs[0]?.rooms ?? 0), groups:Number(catalogs[0]?.groups ?? 0), lessonTypes:Number(catalogs[0]?.lesson_types ?? 0) },
  };
}

export async function commitTeacherScheduleImport(input: {
  administratorId: string;
  fileName: string;
  fileHash: string;
  fileSizeBytes: number;
  warningCount: number;
  rows: readonly TeacherScheduleImportRow[];
}): Promise<ImportCommitResult> {
  if (input.rows.length === 0) throw new Error("Імпорт не містить валідних записів.");

  const sql = getDb();
  const runId = randomUUID();
  const rowsJson = serializedRows(input.rows);
  const sourceIds = input.rows.map((row) => row.sourceId);
  const sourceIdsJson = JSON.stringify(sourceIds);

  const results = await sql.transaction([
    sql`SELECT pg_advisory_xact_lock(hashtext(current_schema()), hashtext('vidmitka-schedule-v2-import'))`,
    sql`
      INSERT INTO schedule_import_runs (
        id, file_name, file_hash, file_size_bytes, status, total_count,
        warning_count, created_by_user_id
      ) VALUES (
        ${runId}, ${input.fileName}, ${input.fileHash}, ${input.fileSizeBytes},
        'previewed', ${input.rows.length}, ${input.warningCount}, ${input.administratorId}
      )
    `,
    sql`
      WITH imported AS (
        SELECT * FROM JSONB_TO_RECORDSET(${rowsJson}::JSONB) AS item(
          row_number INTEGER, source_id TEXT, payload_hash TEXT,
          teacher_name TEXT, teacher_key TEXT, valid_from DATE, valid_until DATE,
          day_of_week SMALLINT, period_number SMALLINT, week_pattern TEXT,
          discipline_name TEXT, discipline_key TEXT,
          room_name TEXT, room_key TEXT, group_items JSONB,
          lesson_type_name TEXT, lesson_type_key TEXT,
          source_schedule_day SMALLINT, source_schedule_week TEXT
        )
      ),
      discipline_catalog AS (
        INSERT INTO disciplines (name, name_normalized)
        SELECT DISTINCT ON (discipline_key) discipline_name, discipline_key FROM imported
        ORDER BY discipline_key, row_number
        ON CONFLICT (name_normalized) DO UPDATE SET
          name = EXCLUDED.name, is_active = TRUE, updated_at = NOW()
        RETURNING id, name_normalized
      ),
      type_catalog AS (
        INSERT INTO schedule_lesson_types (name, name_normalized)
        SELECT DISTINCT ON (lesson_type_key) lesson_type_name, lesson_type_key FROM imported
        ORDER BY lesson_type_key, row_number
        ON CONFLICT (name_normalized) DO UPDATE SET
          name = EXCLUDED.name, is_active = TRUE, updated_at = NOW()
        RETURNING id, name_normalized
      ),
      room_catalog AS (
        INSERT INTO schedule_rooms (name, name_normalized)
        SELECT DISTINCT ON (room_key) room_name, room_key FROM imported
        ORDER BY room_key, row_number
        ON CONFLICT (name_normalized) DO UPDATE SET
          name = EXCLUDED.name, is_active = TRUE, updated_at = NOW()
        RETURNING id, name_normalized
      ),
      teacher_catalog AS (
        INSERT INTO teachers (display_name, display_name_normalized)
        SELECT DISTINCT ON (teacher_key) teacher_name, teacher_key FROM imported
        ORDER BY teacher_key, row_number
        ON CONFLICT (display_name_normalized) DO UPDATE SET
          display_name = EXCLUDED.display_name, is_active = TRUE, updated_at = NOW()
        RETURNING id, display_name_normalized
      ),
      group_catalog AS (
        INSERT INTO academic_groups (code, code_normalized)
        SELECT DISTINCT ON (group_item->>'key') group_item->>'name', group_item->>'key'
        FROM imported
        CROSS JOIN LATERAL JSONB_ARRAY_ELEMENTS(group_items) AS group_item
        ORDER BY group_item->>'key', group_item->>'name'
        ON CONFLICT (code_normalized) DO UPDATE SET
          code = EXCLUDED.code, is_active = TRUE, updated_at = NOW()
        RETURNING id, code_normalized
      ),
      resolved AS (
        SELECT imported.*, discipline_catalog.id AS discipline_id,
          type_catalog.id AS lesson_type_id, room_catalog.id AS room_id,
          teacher_catalog.id AS teacher_id, period.id AS class_period_id
        FROM imported
        JOIN discipline_catalog ON discipline_catalog.name_normalized = imported.discipline_key
        JOIN type_catalog ON type_catalog.name_normalized = imported.lesson_type_key
        JOIN room_catalog ON room_catalog.name_normalized = imported.room_key
        JOIN teacher_catalog ON teacher_catalog.display_name_normalized = imported.teacher_key
        JOIN class_periods AS period ON period.number = imported.period_number AND period.is_active
      ),
      assertion AS (
        SELECT 1 / CASE WHEN (SELECT COUNT(*) FROM resolved) = (SELECT COUNT(*) FROM imported)
          THEN 1 ELSE 0 END AS valid
      ),
      existing_before AS (
        SELECT DISTINCT ON (source_id) source_id, source_payload_hash, source_type, entry_id, exception_id
        FROM (
          SELECT entry.source_id, entry.source_payload_hash, 'entry'::TEXT AS source_type,
            entry.id AS entry_id, NULL::UUID AS exception_id, 0 AS priority
          FROM schedule_entries entry
          JOIN imported ON imported.source_id=entry.source_id
          WHERE entry.source_kind=${SOURCE_KIND}
          UNION ALL
          SELECT exception.source_id, exception.source_payload_hash, 'exception'::TEXT AS source_type,
            NULL::UUID AS entry_id, exception.id AS exception_id, 1 AS priority
          FROM schedule_exceptions exception
          JOIN imported ON imported.source_id=exception.source_id
          WHERE exception.source_kind=${SOURCE_KIND} AND exception.status='active'
        ) sources
        ORDER BY source_id, priority
      ),
      upserted AS (
        INSERT INTO schedule_entries (
          discipline_id, lesson_type_id, class_period_id, day_of_week, week_pattern,
          valid_from, valid_until, is_active, source_kind, source_id, source_payload_hash,
          created_by_user_id, updated_by_user_id
        )
        SELECT discipline_id, lesson_type_id, class_period_id, day_of_week, week_pattern,
          valid_from, valid_until, TRUE, ${SOURCE_KIND}, source_id, payload_hash,
          ${input.administratorId}, ${input.administratorId}
        FROM resolved CROSS JOIN assertion WHERE assertion.valid = 1
        ON CONFLICT (source_kind, source_id)
          WHERE source_kind IS NOT NULL AND source_id IS NOT NULL
        DO UPDATE SET
          discipline_id = EXCLUDED.discipline_id,
          lesson_type_id = EXCLUDED.lesson_type_id,
          class_period_id = EXCLUDED.class_period_id,
          day_of_week = EXCLUDED.day_of_week,
          week_pattern = EXCLUDED.week_pattern,
          valid_from = EXCLUDED.valid_from,
          valid_until = EXCLUDED.valid_until,
          is_active = TRUE,
          source_payload_hash = EXCLUDED.source_payload_hash,
          updated_by_user_id = EXCLUDED.updated_by_user_id,
          updated_at = NOW()
        WHERE schedule_entries.source_payload_hash IS DISTINCT FROM EXCLUDED.source_payload_hash
          OR schedule_entries.day_of_week IS DISTINCT FROM EXCLUDED.day_of_week
          OR schedule_entries.week_pattern IS DISTINCT FROM EXCLUDED.week_pattern
          OR schedule_entries.valid_from IS DISTINCT FROM EXCLUDED.valid_from
          OR schedule_entries.valid_until IS DISTINCT FROM EXCLUDED.valid_until
          OR NOT schedule_entries.is_active
        RETURNING id, source_id
      ),
      import_results AS (
        SELECT imported.row_number, imported.source_id,
          COALESCE(upserted.id, existing_before.entry_id) AS entry_id,
          existing_before.exception_id,
          CASE
            WHEN existing_before.source_id IS NULL THEN 'created'
            WHEN existing_before.source_type='entry' AND existing_before.source_payload_hash=imported.payload_hash THEN 'skipped'
            ELSE 'updated'
          END AS result_status,
          JSONB_BUILD_OBJECT(
            'teacher', imported.teacher_name, 'date', imported.valid_from,
            'validUntil', imported.valid_until,
            'period', imported.period_number, 'subject', imported.discipline_name,
            'room', imported.room_name, 'groups', imported.group_items,
            'lessonType', imported.lesson_type_name, 'dayOfWeek', imported.day_of_week,
            'weekType', imported.week_pattern,
            'substitution', JSONB_BUILD_OBJECT(
              'dayOfWeek', imported.source_schedule_day,
              'weekType', imported.source_schedule_week
            )
          ) AS sanitized_payload
        FROM imported
        LEFT JOIN existing_before ON existing_before.source_id = imported.source_id
        LEFT JOIN upserted ON upserted.source_id = imported.source_id
      ),
      inserted_items AS (
        INSERT INTO schedule_import_items (
          run_id, row_number, source_id, status, message, exception_id, sanitized_payload
        )
        SELECT ${runId}, row_number, source_id, result_status,
          CASE result_status
            WHEN 'created' THEN 'Створено заняття базового розкладу.'
            WHEN 'updated' THEN 'Оновлено або перенесено до базового розкладу.'
            ELSE 'Незмінний запис пропущено.'
          END,
          exception_id, sanitized_payload
        FROM import_results
        RETURNING status
      ),
      updated_run AS (
        UPDATE schedule_import_runs SET
          status = 'committed',
          created_count = (SELECT COUNT(*) FROM inserted_items WHERE status = 'created'),
          updated_count = (SELECT COUNT(*) FROM inserted_items WHERE status = 'updated'),
          skipped_count = (SELECT COUNT(*) FROM inserted_items WHERE status = 'skipped'),
          completed_at = NOW()
        WHERE id = ${runId}
        RETURNING created_count, updated_count, skipped_count
      )
      SELECT * FROM updated_run
    `,
    sql`UPDATE schedule_exceptions SET status='superseded', updated_by_user_id=${input.administratorId}, updated_at=NOW()
      WHERE source_kind=${SOURCE_KIND} AND status='active' AND source_id IN
        (SELECT value FROM JSONB_ARRAY_ELEMENTS_TEXT(${sourceIdsJson}::JSONB))`,
    sql`DELETE FROM schedule_entry_groups WHERE entry_id IN (
      SELECT id FROM schedule_entries WHERE source_kind=${SOURCE_KIND} AND source_id IN
        (SELECT value FROM JSONB_ARRAY_ELEMENTS_TEXT(${sourceIdsJson}::JSONB)))`,
    sql`DELETE FROM schedule_entry_teachers WHERE entry_id IN (
      SELECT id FROM schedule_entries WHERE source_kind=${SOURCE_KIND} AND source_id IN
        (SELECT value FROM JSONB_ARRAY_ELEMENTS_TEXT(${sourceIdsJson}::JSONB)))`,
    sql`DELETE FROM schedule_entry_rooms WHERE entry_id IN (
      SELECT id FROM schedule_entries WHERE source_kind=${SOURCE_KIND} AND source_id IN
        (SELECT value FROM JSONB_ARRAY_ELEMENTS_TEXT(${sourceIdsJson}::JSONB)))`,
    sql`
      WITH imported AS (
        SELECT * FROM JSONB_TO_RECORDSET(${rowsJson}::JSONB) AS item(
          source_id TEXT, group_items JSONB
        )
      )
      INSERT INTO schedule_entry_groups (entry_id, group_id)
      SELECT DISTINCT entry.id, academic_group.id
      FROM imported
      JOIN schedule_entries AS entry
        ON entry.source_kind = ${SOURCE_KIND} AND entry.source_id = imported.source_id
      CROSS JOIN LATERAL JSONB_ARRAY_ELEMENTS(imported.group_items) AS group_item
      JOIN academic_groups AS academic_group ON academic_group.code_normalized = group_item->>'key'
      ON CONFLICT DO NOTHING
    `,
    sql`
      WITH imported AS (
        SELECT * FROM JSONB_TO_RECORDSET(${rowsJson}::JSONB) AS item(
          source_id TEXT, teacher_key TEXT
        )
      )
      INSERT INTO schedule_entry_teachers (entry_id, teacher_id)
      SELECT entry.id, teacher.id
      FROM imported
      JOIN schedule_entries AS entry
        ON entry.source_kind = ${SOURCE_KIND} AND entry.source_id = imported.source_id
      JOIN teachers AS teacher ON teacher.display_name_normalized = imported.teacher_key
      ON CONFLICT DO NOTHING
    `,
    sql`
      WITH imported AS (
        SELECT * FROM JSONB_TO_RECORDSET(${rowsJson}::JSONB) AS item(
          source_id TEXT, room_key TEXT
        )
      )
      INSERT INTO schedule_entry_rooms (entry_id, room_id)
      SELECT entry.id, room.id
      FROM imported
      JOIN schedule_entries AS entry
        ON entry.source_kind = ${SOURCE_KIND} AND entry.source_id = imported.source_id
      JOIN schedule_rooms AS room ON room.name_normalized = imported.room_key
      ON CONFLICT DO NOTHING
    `,
  ], { isolationLevel: "Serializable" });

  const [summary] = results[2] as unknown as Array<{
    created_count: number;
    updated_count: number;
    skipped_count: number;
  }>;
  if (!summary) throw new Error("Не вдалося сформувати звіт імпорту.");

  return {
    runId,
    createdCount: Number(summary.created_count),
    updatedCount: Number(summary.updated_count),
    skippedCount: Number(summary.skipped_count),
  };
}
