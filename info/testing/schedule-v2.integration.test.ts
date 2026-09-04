import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { analyzeTeacherScheduleJson } from "@/lib/schedule-import-v2/parser";

import {
  createScheduleV2TestDatabase,
  destroyScheduleV2TestDatabase,
  qaAdministrator,
} from "./schedule-v2-test-database.mjs";

vi.mock("server-only", () => ({}));

const enabled = process.env.RUN_SCHEDULE_V2_DB_INTEGRATION === "1";
const integration = enabled ? describe.sequential : describe.skip;

type ImportRepository = typeof import("@/lib/schedule-import-v2/repository");
type CatalogRepository = typeof import("@/lib/schedule-v2/catalogs");
type PeriodRepository = typeof import("@/lib/class-periods/repository");
type EntryRepository = typeof import("@/lib/schedule-v2/entries");
type ExceptionRepository = typeof import("@/lib/schedule-v2/exceptions");
type CalendarRepository = typeof import("@/lib/schedule-v2/calendar-overrides");
type PublicRepository = typeof import("@/lib/schedule-v2/public-schedule");
type AuthRepository = typeof import("@/lib/auth/repository");

integration("schedule v2 isolated PostgreSQL integration", () => {
  const baseConnectionString = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "";
  let database: Awaited<ReturnType<typeof createScheduleV2TestDatabase>>;
  let importRepository: ImportRepository;
  let catalogRepository: CatalogRepository;
  let periodRepository: PeriodRepository;
  let entryRepository: EntryRepository;
  let exceptionRepository: ExceptionRepository;
  let calendarRepository: CalendarRepository;
  let publicRepository: PublicRepository;
  let authRepository: AuthRepository;

  beforeAll(async () => {
    database = await createScheduleV2TestDatabase(baseConnectionString);
    process.env.DATABASE_URL = database.connectionString;
    process.env.QA_TEST_SCHEMA = database.schemaName;
    vi.resetModules();
    [importRepository, catalogRepository, periodRepository, entryRepository, exceptionRepository, calendarRepository, publicRepository, authRepository] = await Promise.all([
      import("@/lib/schedule-import-v2/repository"),
      import("@/lib/schedule-v2/catalogs"),
      import("@/lib/class-periods/repository"),
      import("@/lib/schedule-v2/entries"),
      import("@/lib/schedule-v2/exceptions"),
      import("@/lib/schedule-v2/calendar-overrides"),
      import("@/lib/schedule-v2/public-schedule"),
      import("@/lib/auth/repository"),
    ]);
  }, 120_000);

  afterAll(async () => {
    if (database?.schemaName) await destroyScheduleV2TestDatabase(baseConnectionString, database.schemaName);
    delete process.env.QA_TEST_SCHEMA;
  }, 30_000);

  it("applies migration 014 twice inside the isolated schema", async () => {
    const [scope] = await database.sql`SELECT current_schema() AS schema_name`;
    const [tables] = await database.sql`SELECT COUNT(*)::INTEGER AS count FROM information_schema.tables WHERE table_schema=${database.schemaName}`;
    expect(scope?.schema_name).toBe(database.schemaName);
    expect(Number(tables?.count)).toBeGreaterThanOrEqual(18);
    expect(database.statementCount).toBeGreaterThan(10);
  });

  it("authenticates valid administrator credentials and manages a hashed session", async () => {
    const invalid = await authRepository.authenticateAccount({ email: qaAdministrator.email, password: "Wrong1!" });
    expect(invalid.success).toBe(false);
    const valid = await authRepository.authenticateAccount({ email: qaAdministrator.email, password: qaAdministrator.password });
    expect(valid.success && valid.user.role).toBe("administrator");
    const session = await authRepository.createAuthSession(qaAdministrator.id);
    expect((await authRepository.findUserBySessionToken(session.token))?.email).toBe(qaAdministrator.email);
    await authRepository.revokeAuthSession(session.token);
    expect(await authRepository.findUserBySessionToken(session.token)).toBeNull();
  });

  it("runs actual JSON preview, idempotent import, update and transactional rollback", async () => {
    const content = await readFile(path.resolve(process.cwd(), "data/teacher-schedule-lessons.json"), "utf8");
    const analysis = analyzeTeacherScheduleJson(content);
    expect(analysis.ok).toBe(true);
    if (!analysis.ok) return;
    expect(analysis.rows).toHaveLength(431);
    expect(await importRepository.previewTeacherScheduleImport(analysis.rows)).toMatchObject({
      createCount: 431, updateCount: 0, skipCount: 0, missingPeriods: [],
    });
    const first = await importRepository.commitTeacherScheduleImport({
      administratorId: qaAdministrator.id, fileName: "teacher-schedule-lessons.json", fileHash: "a".repeat(64),
      fileSizeBytes: Buffer.byteLength(content), warningCount: analysis.warnings.length, rows: analysis.rows,
    });
    expect(first).toMatchObject({ createdCount: 431, updatedCount: 0, skippedCount: 0 });
    const [importedSummary] = await database.sql`
      SELECT COUNT(*)::INTEGER AS entries,
        COUNT(*) FILTER (WHERE valid_until='2026-12-31'::DATE)::INTEGER AS ending_in_december
      FROM schedule_entries
      WHERE source_kind='teacher_schedule_json' AND is_active
    `;
    expect(importedSummary).toMatchObject({ entries: 431, ending_in_december: 431 });
    const [firstImportedEntry] = await database.sql`
      SELECT id::TEXT FROM schedule_entries
      WHERE source_kind='teacher_schedule_json' AND source_id=${analysis.rows[0]!.sourceId}
    `;
    const recurringDate = new Date(`${analysis.rows[0]!.validFrom}T00:00:00Z`);
    recurringDate.setUTCDate(recurringDate.getUTCDate() + 14);
    const recurringItem = (await publicRepository.getPublicScheduleDay({
      date: recurringDate.toISOString().slice(0, 10),
    })).items.find((item) => item.id === firstImportedEntry!.id);
    expect(recurringItem).toMatchObject({ changeKind: null, changeReason: "", note: "" });
    expect((await publicRepository.getPublicScheduleDay({ date: "2027-01-04" }))
      .items.some((item) => item.id === firstImportedEntry!.id)).toBe(false);
    expect(await importRepository.previewTeacherScheduleImport(analysis.rows)).toMatchObject({ createCount: 0, updateCount: 0, skipCount: 431 });
    const second = await importRepository.commitTeacherScheduleImport({
      administratorId: qaAdministrator.id, fileName: "teacher-schedule-lessons.json", fileHash: "a".repeat(64),
      fileSizeBytes: Buffer.byteLength(content), warningCount: analysis.warnings.length, rows: analysis.rows,
    });
    expect(second).toMatchObject({ createdCount: 0, updatedCount: 0, skippedCount: 431 });

    const raw = JSON.parse(content) as Array<Record<string, unknown>>;
    const changed = analyzeTeacherScheduleJson(JSON.stringify([{ ...raw[0], subject: "Уточнена тестом дисципліна" }]));
    expect(changed.ok).toBe(true);
    if (!changed.ok) return;
    expect(await importRepository.previewTeacherScheduleImport(changed.rows)).toMatchObject({ updateCount: 1 });
    expect(await importRepository.commitTeacherScheduleImport({
      administratorId: qaAdministrator.id, fileName: "changed.json", fileHash: "b".repeat(64), fileSizeBytes: 1000,
      warningCount: changed.warnings.length, rows: changed.rows,
    })).toMatchObject({ updatedCount: 1 });

    const migrationRow = analysis.rows.at(-1)!;
    const [legacySource] = await database.sql`
      SELECT id, discipline_id, lesson_type_id, class_period_id
      FROM schedule_entries
      WHERE source_kind='teacher_schedule_json' AND source_id=${migrationRow.sourceId}
    `;
    await database.sql`DELETE FROM schedule_entries WHERE id=${legacySource!.id}`;
    const legacyExceptionId = randomUUID();
    await database.sql`
      INSERT INTO schedule_exceptions (
        id, kind, original_date, class_period_id, discipline_id, lesson_type_id,
        source_kind, source_id, source_payload_hash, created_by_user_id, updated_by_user_id
      ) VALUES (
        ${legacyExceptionId}, 'one_time', ${migrationRow.validFrom}, ${legacySource!.class_period_id},
        ${legacySource!.discipline_id}, ${legacySource!.lesson_type_id}, 'teacher_schedule_json',
        ${migrationRow.sourceId}, ${migrationRow.payloadHash}, ${qaAdministrator.id}, ${qaAdministrator.id}
      )
    `;
    expect(await importRepository.previewTeacherScheduleImport([migrationRow]))
      .toMatchObject({ createCount: 0, updateCount: 1, skipCount: 0 });
    expect(await importRepository.commitTeacherScheduleImport({
      administratorId: qaAdministrator.id, fileName: "legacy-migration.json", fileHash: "e".repeat(64),
      fileSizeBytes: 1000, warningCount: 0, rows: [migrationRow],
    })).toMatchObject({ createdCount: 0, updatedCount: 1, skippedCount: 0 });
    const [migrationState] = await database.sql`
      SELECT
        (SELECT COUNT(*)::INTEGER FROM schedule_entries
          WHERE source_kind='teacher_schedule_json' AND source_id=${migrationRow.sourceId}) AS entries,
        (SELECT status FROM schedule_exceptions WHERE id=${legacyExceptionId}) AS legacy_status
    `;
    expect(migrationState).toMatchObject({ entries: 1, legacy_status: "superseded" });

    const invalidPeriod = analyzeTeacherScheduleJson(JSON.stringify([{ ...raw[0], period: 99 }]));
    expect(invalidPeriod.ok).toBe(true);
    if (!invalidPeriod.ok) return;
    const [before] = await database.sql`SELECT (SELECT COUNT(*) FROM schedule_import_runs)::INTEGER AS runs,
      (SELECT COUNT(*) FROM schedule_entries)::INTEGER AS entries,
      (SELECT COUNT(*) FROM schedule_exceptions)::INTEGER AS exceptions`;
    await expect(importRepository.commitTeacherScheduleImport({
      administratorId: qaAdministrator.id, fileName: "rollback.json", fileHash: "c".repeat(64), fileSizeBytes: 1000,
      warningCount: 0, rows: invalidPeriod.rows,
    })).rejects.toThrow();
    const [after] = await database.sql`SELECT (SELECT COUNT(*) FROM schedule_import_runs)::INTEGER AS runs,
      (SELECT COUNT(*) FROM schedule_entries)::INTEGER AS entries,
      (SELECT COUNT(*) FROM schedule_exceptions)::INTEGER AS exceptions`;
    expect(after).toEqual(before);
  }, 120_000);

  it("saves changed catalog rows together and rejects an invalid batch without partial writes", async () => {
    const kinds = ["groups", "disciplines", "rooms", "teachers", "lesson-types"] as const;
    for (const kind of kinds) {
      const suffix = kind.replace("-", " ");
      const create = new FormData(); create.set("name", `QA ${suffix}`); if (kind === "lesson-types") create.set("color", "#48C5B5");
      expect((await catalogRepository.createScheduleCatalogEntry(kind, create)).success).toBe(true);
      const second = new FormData(); second.set("name", `QA ${suffix} second`); if (kind === "lesson-types") second.set("color", "#0F766E");
      expect((await catalogRepository.createScheduleCatalogEntry(kind, second)).success).toBe(true);
      const created = (await catalogRepository.listScheduleCatalog(kind)).filter((item) => item.name.startsWith(`QA ${suffix}`));
      expect(created).toHaveLength(2);
      const first = created.find((item) => item.name === `QA ${suffix}`)!;
      const other = created.find((item) => item.name === `QA ${suffix} second`)!;
      expect(await catalogRepository.updateScheduleCatalogEntries(kind, [
        { id: first.id, name: `QA ${suffix} updated`, ...(kind === "lesson-types" ? { color: "#16835B" } : {}) },
        { id: other.id, name: `QA ${suffix} second updated`, ...(kind === "lesson-types" ? { color: "#073C40" } : {}) },
      ])).toMatchObject({ success: true });
      const afterBatch = await catalogRepository.listScheduleCatalog(kind);
      expect(afterBatch.find((item) => item.id === first.id)?.name).toBe(`QA ${suffix} updated`);
      expect(await catalogRepository.updateScheduleCatalogEntries(kind, [
        { id: first.id, name: "Однакова назва", ...(kind === "lesson-types" ? { color: "#16835B" } : {}) },
        { id: other.id, name: "Однакова назва", ...(kind === "lesson-types" ? { color: "#073C40" } : {}) },
      ])).toMatchObject({ success: false });
      expect((await catalogRepository.listScheduleCatalog(kind)).find((item) => item.id === first.id)?.name).toBe(`QA ${suffix} updated`);
      expect((await catalogRepository.setScheduleCatalogEntryActive(kind, first.id, false)).success).toBe(true);
      expect((await catalogRepository.deleteScheduleCatalogEntry(kind, first.id)).success).toBe(true);
      expect((await catalogRepository.deleteScheduleCatalogEntry(kind, other.id)).success).toBe(true);
    }
  });

  it("saves multiple changed class periods atomically", async () => {
    const [first, second] = await periodRepository.listClassPeriods();
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    const before = await periodRepository.listClassPeriods();
    expect(await periodRepository.updateClassPeriods([
      { id: first!.id, number: String(first!.number), startTime: first!.startTime, endTime: first!.endTime, color: "#16835B" },
      { id: second!.id, number: String(second!.number), startTime: second!.startTime, endTime: second!.endTime, color: "#073C40" },
    ])).toMatchObject({ success: true });
    expect(await periodRepository.updateClassPeriods([
      { id: first!.id, number: String(second!.number), startTime: first!.startTime, endTime: first!.endTime, color: "#16835B" },
      { id: second!.id, number: String(second!.number), startTime: second!.startTime, endTime: second!.endTime, color: "#073C40" },
    ])).toMatchObject({ success: false });
    expect((await periodRepository.listClassPeriods()).map((period) => period.number)).toEqual(before.map((period) => period.number));
  });

  it("returns active groups and the ordered public bell timetable", async () => {
    const groups = await publicRepository.listPublicGroups();
    expect(groups).toContainEqual({ id: database.fixture.groupId, name: "QA-1" });

    const teachers = await publicRepository.listPublicTeachers();
    expect(teachers).toContainEqual({ id: database.fixture.teacherId, name: "Тестовий Викладач" });

    const periods = await publicRepository.listPublicPeriods();
    expect(periods).toHaveLength(8);
    expect(periods.map((period) => period.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(periods.find((period) => period.id === database.fixture.periodId)).toMatchObject({
      number: 2,
      startTime: "09:35",
      endTime: "10:55",
    });
    expect(periods.every((period) => /^#[0-9A-F]{6}$/u.test(period.color))).toBe(true);

    const unfilteredDay = await publicRepository.getPublicScheduleDay({ date: "2026-09-02", groupId: null });
    expect(unfilteredDay.items.find((item) => item.discipline === "Тестова дисципліна")?.groups).toEqual(["QA-1"]);

    const teacherDay = await publicRepository.getPublicScheduleDay({
      date: "2026-09-02",
      groupId: null,
      teacherId: database.fixture.teacherId,
    });
    expect(teacherDay.items.find((item) => item.discipline === "Тестова дисципліна")?.teachers).toEqual(["Тестовий Викладач"]);

    const otherTeacherId = randomUUID();
    await database.sql`INSERT INTO teachers (id, display_name, display_name_normalized)
      VALUES (${otherTeacherId}, 'Інший Викладач', 'інший викладач')`;
    expect((await publicRepository.getPublicScheduleDay({
      date: "2026-09-02",
      groupId: null,
      teacherId: otherTeacherId,
    })).items.some((item) => item.discipline === "Тестова дисципліна")).toBe(false);

    const staleTeacherDay = await publicRepository.getPublicScheduleDay({
      date: "2026-09-02",
      groupId: null,
      teacherId: randomUUID(),
    });
    expect(staleTeacherDay.items.some((item) => item.discipline === "Тестова дисципліна")).toBe(true);
  });

  it("projects legacy imported exceptions as recurring schedule without import labels", async () => {
    const legacyId = randomUUID();
    await database.sql`
      INSERT INTO schedule_exceptions (
        id, kind, original_date, class_period_id, discipline_id, lesson_type_id,
        reason, note, source_kind, source_id, source_payload_hash,
        created_by_user_id, updated_by_user_id
      ) VALUES (
        ${legacyId}, 'one_time', '2026-09-01', ${database.fixture.periodId},
        ${database.fixture.disciplineId}, ${database.fixture.typeId},
        'Імпортований датований розклад', 'Технічна примітка',
        'teacher_schedule_json', ${`legacy-${legacyId}`}, ${"d".repeat(64)},
        ${qaAdministrator.id}, ${qaAdministrator.id}
      )
    `;
    await database.sql`INSERT INTO schedule_exception_groups (exception_id, group_id)
      VALUES (${legacyId}, ${database.fixture.groupId})`;
    await database.sql`INSERT INTO schedule_exception_teachers (exception_id, teacher_id)
      VALUES (${legacyId}, ${database.fixture.teacherId})`;
    await database.sql`INSERT INTO schedule_exception_rooms (exception_id, room_id)
      VALUES (${legacyId}, ${database.fixture.roomId})`;

    const recurring = (await publicRepository.getPublicScheduleDay({
      date: "2026-09-15",
      groupId: database.fixture.groupId,
    })).items.find((item) => item.id === legacyId);
    expect(recurring).toMatchObject({ changeKind: null, changeReason: "", note: "" });
    expect((await publicRepository.getPublicScheduleDay({
      date: "2027-01-05",
      groupId: database.fixture.groupId,
    })).items.some((item) => item.id === legacyId)).toBe(false);

    await database.sql`DELETE FROM schedule_exceptions WHERE id=${legacyId}`;
  });

  it("enforces conflicts and resolves move, replacement, cancel and one-time exceptions", async () => {
    const fixture = database.fixture;
    const secondRoomId = randomUUID();
    await database.sql`INSERT INTO schedule_rooms (id, name, name_normalized) VALUES (${secondRoomId}, 'QA-202', 'qa-202')`;
    const createEntryForm = () => {
      const form = new FormData();
      form.set("disciplineId", fixture.disciplineId); form.set("lessonTypeId", fixture.typeId); form.set("periodId", fixture.periodId);
      form.set("dayOfWeek", "4"); form.set("weekPattern", "both"); form.set("validFrom", "2026-08-31"); form.set("validUntil", "2026-12-31");
      form.append("groupIds", fixture.groupId); form.append("teacherIds", fixture.teacherId); form.append("roomIds", fixture.roomId);
      return form;
    };
    expect((await entryRepository.createScheduleEntry(qaAdministrator.id, createEntryForm())).success).toBe(true);
    expect((await entryRepository.createScheduleEntry(qaAdministrator.id, createEntryForm())).message).toContain("Конфлікт");
    const entry = (await entryRepository.listScheduleEntries()).find((item) =>
      item.dayOfWeek === 4 && item.groups.some((group) => group.id === fixture.groupId))!;

    const move = new FormData(); move.set("kind", "move"); move.set("baseEntryId", entry.id); move.set("originalDate", "2026-09-03"); move.set("newDate", "2026-09-04");
    expect((await exceptionRepository.createScheduleException(qaAdministrator.id, move)).success).toBe(true);
    expect((await publicRepository.getPublicScheduleDay({ date: "2026-09-03", groupId: fixture.groupId }))
      .items.some((item) => item.id === entry.id)).toBe(false);
    expect((await publicRepository.getPublicScheduleDay({ date: "2026-09-04", groupId: fixture.groupId })).items.filter((item) => item.changeKind === "move")).toHaveLength(1);
    const moveId = (await exceptionRepository.listScheduleExceptions()).find((item) => item.kind === "move")!.id;
    await exceptionRepository.deleteScheduleException(moveId);

    const roomChange = new FormData(); roomChange.set("kind", "room_change"); roomChange.set("baseEntryId", entry.id); roomChange.set("originalDate", "2026-09-03"); roomChange.append("roomIds", secondRoomId);
    expect((await exceptionRepository.createScheduleException(qaAdministrator.id, roomChange)).success).toBe(true);
    expect((await publicRepository.getPublicScheduleDay({ date: "2026-09-03", groupId: fixture.groupId })).items[0]?.rooms).toEqual(["QA-202"]);
    const roomChangeId = (await exceptionRepository.listScheduleExceptions()).find((item) => item.kind === "room_change")!.id;
    await exceptionRepository.deleteScheduleException(roomChangeId);

    const cancel = new FormData(); cancel.set("kind", "cancel"); cancel.set("baseEntryId", entry.id); cancel.set("originalDate", "2026-09-03");
    expect((await exceptionRepository.createScheduleException(qaAdministrator.id, cancel)).success).toBe(true);
    expect((await publicRepository.getPublicScheduleDay({ date: "2026-09-03", groupId: fixture.groupId })).items[0]?.cancelled).toBe(true);

    const oneTime = new FormData(); oneTime.set("kind", "one_time"); oneTime.set("originalDate", "2026-09-05"); oneTime.set("periodId", fixture.periodId);
    oneTime.set("disciplineId", fixture.disciplineId); oneTime.set("lessonTypeId", fixture.typeId);
    oneTime.append("groupIds", fixture.groupId); oneTime.append("teacherIds", fixture.teacherId); oneTime.append("roomIds", fixture.roomId);
    expect((await exceptionRepository.createScheduleException(qaAdministrator.id, oneTime)).success).toBe(true);
    expect((await publicRepository.getPublicScheduleDay({ date: "2026-09-05", groupId: fixture.groupId })).items.some((item) => item.changeKind === "one_time")).toBe(true);
  }, 60_000);

  it("returns a public API payload without administrator fields", async () => {
    const { GET } = await import("@/app/api/public/schedule/route");
    const { NextRequest } = await import("next/server");
    const response = await GET(new NextRequest(`http://localhost/api/public/schedule?date=2026-09-02&groupId=${database.fixture.groupId}`));
    expect(response.status).toBe(200);
    const payload = await response.json() as Record<string, unknown>;
    expect(JSON.stringify(payload)).not.toMatch(/password|email|created_by|updated_by/iu);

    const teacherResponse = await GET(new NextRequest(
      `http://localhost/api/public/schedule?date=2026-09-02&teacherId=${database.fixture.teacherId}`,
    ));
    expect(teacherResponse.status).toBe(200);
    const teacherPayload = await teacherResponse.json() as { data: { items: Array<{ teachers: string[] }> } };
    expect(teacherPayload.data.items.every((item) => item.teachers.includes("Тестовий Викладач"))).toBe(true);

    const invalidTeacherResponse = await GET(new NextRequest(
      "http://localhost/api/public/schedule?date=2026-09-02&teacherId=invalid",
    ));
    expect(invalidTeacherResponse.status).toBe(400);
  });

  it("returns only active rooms that are free in the complete schedule period", async () => {
    const freeRoomId = randomUUID();
    await database.sql`
      INSERT INTO schedule_rooms (id, name, name_normalized)
      VALUES (${freeRoomId}, 'QA-303', 'qa-303')
    `;

    const { GET } = await import("@/app/api/public/free-rooms/route");
    const { NextRequest } = await import("next/server");
    const response = await GET(new NextRequest(
      "http://localhost/api/public/free-rooms?date=2026-09-02&periodNumber=2",
    ));
    expect(response.status).toBe(200);
    const payload = await response.json() as {
      data: { rooms: Array<{ id: string; name: string }>; availableCount: number; totalCount: number };
    };
    expect(payload.data.rooms).toContainEqual({ id: freeRoomId, name: "QA-303" });
    expect(payload.data.rooms.some((room) => room.id === database.fixture.roomId)).toBe(false);
    expect(payload.data.availableCount).toBe(payload.data.rooms.length);
    expect(payload.data.totalCount).toBeGreaterThan(payload.data.availableCount);

    const invalidPeriod = await GET(new NextRequest(
      "http://localhost/api/public/free-rooms?date=2026-09-02&periodNumber=0",
    ));
    expect(invalidPeriod.status).toBe(400);
  });

  it("applies a calendar transfer to the public schedule without copying the base entry", async () => {
    const saved = await calendarRepository.saveCalendarOverride(qaAdministrator.id, {
      date: "2026-09-04",
      dayOfWeek: "4",
      weekType: "numerator",
      version: "0",
    });
    expect(saved.success).toBe(true);

    const context = await calendarRepository.getCalendarDayContext("2026-09-04");
    expect(context).toMatchObject({
      calendarDayOfWeek: 5,
      dayOfWeek: 4,
      weekType: "numerator",
      isOverride: true,
    });
    const day = await publicRepository.getPublicScheduleDay({
      date: "2026-09-04",
      groupId: database.fixture.groupId,
    });
    expect(day).toMatchObject({
      scheduleDayOfWeek: 4,
      weekType: "numerator",
      isTransfer: true,
    });
    expect(day.items.some((item) => item.discipline === "Тестова дисципліна")).toBe(true);

    const [item] = await calendarRepository.listCalendarOverrides();
    expect((await calendarRepository.deleteCalendarOverride(qaAdministrator.id, {
      date: item.date,
      version: String(item.version),
    })).success).toBe(true);
  });
});
