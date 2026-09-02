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
    [importRepository, catalogRepository, entryRepository, exceptionRepository, calendarRepository, publicRepository, authRepository] = await Promise.all([
      import("@/lib/schedule-import-v2/repository"),
      import("@/lib/schedule-v2/catalogs"),
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

    const invalidPeriod = analyzeTeacherScheduleJson(JSON.stringify([{ ...raw[0], period: 99 }]));
    expect(invalidPeriod.ok).toBe(true);
    if (!invalidPeriod.ok) return;
    const [before] = await database.sql`SELECT (SELECT COUNT(*) FROM schedule_import_runs)::INTEGER AS runs,
      (SELECT COUNT(*) FROM schedule_exceptions)::INTEGER AS exceptions`;
    await expect(importRepository.commitTeacherScheduleImport({
      administratorId: qaAdministrator.id, fileName: "rollback.json", fileHash: "c".repeat(64), fileSizeBytes: 1000,
      warningCount: 0, rows: invalidPeriod.rows,
    })).rejects.toThrow();
    const [after] = await database.sql`SELECT (SELECT COUNT(*) FROM schedule_import_runs)::INTEGER AS runs,
      (SELECT COUNT(*) FROM schedule_exceptions)::INTEGER AS exceptions`;
    expect(after).toEqual(before);
  }, 120_000);

  it("performs CRUD for every catalog kind without breaking dependencies", async () => {
    const kinds = ["groups", "disciplines", "rooms", "teachers", "lesson-types"] as const;
    for (const kind of kinds) {
      const suffix = kind.replace("-", " ");
      const create = new FormData(); create.set("name", `QA ${suffix}`); if (kind === "lesson-types") create.set("color", "#48C5B5");
      expect((await catalogRepository.createScheduleCatalogEntry(kind, create)).success).toBe(true);
      const created = (await catalogRepository.listScheduleCatalog(kind)).find((item) => item.name === `QA ${suffix}`);
      expect(created).toBeDefined();
      const update = new FormData(); update.set("name", `QA ${suffix} updated`); if (kind === "lesson-types") update.set("color", "#0F766E");
      expect((await catalogRepository.updateScheduleCatalogEntry(kind, created!.id, update)).success).toBe(true);
      expect((await catalogRepository.setScheduleCatalogEntryActive(kind, created!.id, false)).success).toBe(true);
      expect((await catalogRepository.deleteScheduleCatalogEntry(kind, created!.id)).success).toBe(true);
    }
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
    const entry = (await entryRepository.listScheduleEntries()).find((item) => item.dayOfWeek === 4)!;

    const move = new FormData(); move.set("kind", "move"); move.set("baseEntryId", entry.id); move.set("originalDate", "2026-09-03"); move.set("newDate", "2026-09-04");
    expect((await exceptionRepository.createScheduleException(qaAdministrator.id, move)).success).toBe(true);
    expect((await publicRepository.getPublicScheduleDay({ date: "2026-09-03", groupId: fixture.groupId })).items).toHaveLength(0);
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
