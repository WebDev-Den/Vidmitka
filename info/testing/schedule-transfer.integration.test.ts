import { createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createScheduleV2TestDatabase, destroyScheduleV2TestDatabase, qaAdministrator } from "./schedule-v2-test-database.mjs";
import type { ScheduleSnapshot } from "@/lib/schedule-transfer/schema";

const integration = process.env.RUN_TRANSFER_DB_INTEGRATION === "1" ? describe.sequential : describe.skip;

integration("schedule export and dry-run in isolated PostgreSQL", () => {
  const original = { DATABASE_URL: process.env.DATABASE_URL, QA_TEST_SCHEMA: process.env.QA_TEST_SCHEMA };
  const base = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "";
  let database: Awaited<ReturnType<typeof createScheduleV2TestDatabase>>;
  let transfer: typeof import("@/lib/schedule-transfer/repository");
  let parse: typeof import("@/lib/schedule-transfer/schema")["parseSnapshot"];
  beforeAll(async () => {
    database = await createScheduleV2TestDatabase(base);
    process.env.DATABASE_URL = database.connectionString;
    process.env.QA_TEST_SCHEMA = database.schemaName;
    vi.resetModules();
    transfer = await import("@/lib/schedule-transfer/repository");
    parse = (await import("@/lib/schedule-transfer/schema")).parseSnapshot;
  }, 120_000);
  afterAll(async () => {
    try { if (database?.schemaName) await destroyScheduleV2TestDatabase(base, database.schemaName); }
    finally { for (const [key, value] of Object.entries(original)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } }
  }, 30_000);
  function commit(snapshot: ScheduleSnapshot, expectedFingerprint: string, administratorId: string = qaAdministrator.id) {
    const content = JSON.stringify(snapshot);
    return transfer.commitSnapshot({ snapshot, expectedFingerprint, administratorId, fileName: "qa-snapshot.json",
      fileHash: createHash("sha256").update(content).digest("hex"), fileSize: Buffer.byteLength(content), confirmWarnings: true });
  }
  it("exports only schedule data and previews a reimport without writes", async () => {
    const snapshot = parse(await transfer.exportScheduleSnapshot());
    expect(Object.keys(snapshot.data).sort()).toEqual(["calendar", "disciplines", "entries", "exceptions", "groups", "lessonTypes", "periods", "rooms", "teachers", "weeks"]);
    expect(snapshot.data.entries[0].valid_from).toBe("2026-08-31");
    expect(JSON.stringify(snapshot)).not.toContain("password");
    const preview = await transfer.previewSnapshot(snapshot);
    expect(preview.plan.errors).toEqual([]);
    expect(preview.plan.counts.find((row) => row.section === "entries")).toMatchObject({ created: 0, updated: 0, unchanged: 1 });
    expect((await transfer.exportScheduleSnapshot()).data).toEqual(snapshot.data);
    const [runs] = await database.sql`SELECT COUNT(*) AS count FROM schedule_import_runs`;
    expect(Number(runs.count)).toBe(0);
    await commit(snapshot, preview.fingerprint);
    expect((await transfer.exportScheduleSnapshot()).data).toEqual(snapshot.data);
  }, 30_000);
  it("upserts entries, memberships, periods and calendar without duplicate records", async () => {
    const snapshot = parse(await transfer.exportScheduleSnapshot());
    snapshot.data.groups.push({ ...snapshot.data.groups[0], id: "525ba3ef-1051-4768-8fe7-32b892ebfe9c", code: "TRANSFER-2" });
    snapshot.data.periods.push({ number: 89, start_minute: 1260, end_minute: 1320, is_active: true, color: "#0F766E" });
    snapshot.data.entries[0] = { ...snapshot.data.entries[0], note: "Змінено через файл", group_ids: ["525ba3ef-1051-4768-8fe7-32b892ebfe9c"], period_number: 89 };
    snapshot.data.calendar.push({ held_on: "2031-02-01", schedule_day: 2, week_type: "denominator", is_active: true });
    const preview = await transfer.previewSnapshot(snapshot);
    expect(preview.plan.errors).toEqual([]);
    await commit(snapshot, preview.fingerprint);
    const actual = (await transfer.exportScheduleSnapshot()).data;
    expect(actual.entries[0]).toMatchObject({ note: "Змінено через файл", group_ids: ["525ba3ef-1051-4768-8fe7-32b892ebfe9c"], period_number: 89 });
    expect(actual.groups).toHaveLength(2);
    const repeat = await transfer.previewSnapshot(snapshot);
    expect(repeat.plan.counts.every((row) => row.created === 0 && row.updated === 0)).toBe(true);
    await commit(snapshot, repeat.fingerprint);
    expect((await transfer.exportScheduleSnapshot()).data).toEqual(actual);
  }, 30_000);
  it("rejects a stale preview without replacing newer changes", async () => {
    const snapshot = parse(await transfer.exportScheduleSnapshot());
    const oldPreview = await transfer.previewSnapshot(snapshot);
    const newer = structuredClone(snapshot);
    newer.data.entries[0].note = "Новіша редакція";
    await commit(newer, oldPreview.fingerprint);
    await expect(commit(snapshot, oldPreview.fingerprint)).rejects.toThrow("змінився");
    expect((await transfer.exportScheduleSnapshot()).data.entries[0].note).toBe("Новіша редакція");
  }, 30_000);
  it("refuses an unauthorized commit without writing any of its changes", async () => {
    const snapshot = parse(await transfer.exportScheduleSnapshot());
    const before = structuredClone(snapshot.data);
    snapshot.data.groups[0].code = "Unauthorized";
    const preview = await transfer.previewSnapshot(snapshot);
    await expect(commit(snapshot, preview.fingerprint, "unknown-administrator")).rejects.toThrow();
    expect((await transfer.exportScheduleSnapshot()).data).toEqual(before);
  }, 30_000);
  it("protects calendar dates with attendance and leaves the rest untouched", async () => {
    await database.sql`INSERT INTO attendance_sessions (id, held_on) VALUES ('transfer-journal', '2031-02-01')`;
    const snapshot = parse(await transfer.exportScheduleSnapshot());
    const before = structuredClone(snapshot.data);
    snapshot.data.calendar[0].schedule_day = 3;
    snapshot.data.groups[0].code = "Must not change";
    const preview = await transfer.previewSnapshot(snapshot);
    expect(preview.plan.errors.join(" ")).toContain("журналом");
    await expect(commit(snapshot, preview.fingerprint)).rejects.toThrow();
    expect((await transfer.exportScheduleSnapshot()).data).toEqual(before);
  }, 30_000);
});
