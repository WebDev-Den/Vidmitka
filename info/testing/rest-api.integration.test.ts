import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createScheduleV2TestDatabase, destroyScheduleV2TestDatabase, qaAdministrator } from "./schedule-v2-test-database.mjs";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const integration = process.env.RUN_REST_API_DB_INTEGRATION === "1" ? describe.sequential : describe.skip;

integration("REST API with isolated PostgreSQL", () => {
  const original = { DATABASE_URL: process.env.DATABASE_URL, QA_TEST_SCHEMA: process.env.QA_TEST_SCHEMA, SCHEDULE_API_KEY: process.env.SCHEDULE_API_KEY, SCHEDULE_API_ADMIN_ID: process.env.SCHEDULE_API_ADMIN_ID };
  const base = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "";
  const apiKey = randomBytes(32).toString("base64url");
  let database: Awaited<ReturnType<typeof createScheduleV2TestDatabase>>;
  let handler: typeof import("@/lib/rest-api/handler")["handleApiRequest"];
  beforeAll(async () => {
    database = await createScheduleV2TestDatabase(base);
    process.env.DATABASE_URL = database.connectionString;
    process.env.QA_TEST_SCHEMA = database.schemaName;
    process.env.SCHEDULE_API_KEY = apiKey;
    process.env.SCHEDULE_API_ADMIN_ID = qaAdministrator.id;
    vi.resetModules();
    handler = (await import("@/lib/rest-api/handler")).handleApiRequest;
  }, 120_000);
  afterAll(async () => {
    try { if (database?.schemaName) await destroyScheduleV2TestDatabase(base, database.schemaName); }
    finally { for (const [key, value] of Object.entries(original)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } }
  }, 30_000);

  async function call(path: string, method = "GET", body?: unknown, authorized = true) {
    const url = new URL(`https://example.test/api/v1/${path}`);
    const request = new Request(url, { method, headers: { ...(authorized ? { Authorization: `Bearer ${apiKey}` } : {}), ...(body === undefined ? {} : { "Content-Type": "application/json" }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const response = await handler(request, url.pathname.slice("/api/v1/".length).split("/"));
    return { response, body: await response.json() };
  }
  async function create(resource: string, value: unknown): Promise<string> {
    const result = await call(resource, "POST", value);
    expect(result.response.status, JSON.stringify(result.body)).toBe(201);
    expect(result.body.data.id).toBeTruthy();
    return result.body.data.id;
  }
  it("denies unauthenticated writes and revoked administrator access", async () => {
    expect((await call("groups", "POST", { name: "Unauthorized" }, false)).response.status).toBe(401);
    const [before] = await database.sql`SELECT COUNT(*) AS count FROM academic_groups WHERE code='Unauthorized'`;
    expect(Number(before.count)).toBe(0);
    process.env.SCHEDULE_API_ADMIN_ID = "c5ee4a65-f486-4e32-a8d2-c7ca426dab82";
    expect((await call("groups")).response.status).toBe(403);
    process.env.SCHEDULE_API_ADMIN_ID = qaAdministrator.id;
  });
  it("supports all catalog CRUD, activation and pagination", async () => {
    for (const resource of ["groups", "teachers", "disciplines", "rooms", "lesson-types"]) {
      const value = { name: `REST-${resource}`, ...(resource === "lesson-types" ? { color: "#0F766E" } : {}) };
      const id = await create(resource, value);
      expect((await call(`${resource}/${id}`)).body.data.name).toBe(value.name);
      expect((await call(`${resource}/${id}`, "PUT", { ...value, name: `${value.name}-updated` })).response.status).toBe(200);
      expect((await call(`${resource}/${id}`, "PATCH", { isActive: false })).response.status).toBe(200);
      const listed = await call(`${resource}?limit=1&active=false&q=REST-`);
      expect(listed.body.data.items.length).toBe(1);
      expect((await call(`${resource}/${id}`, "DELETE")).response.status).toBe(200);
      expect((await call(`${resource}/${id}`)).response.status).toBe(404);
    }
  }, 60_000);
  it("manages linked entries, exceptions and periods while preserving references and conflicts", async () => {
    const groupId = await create("groups", { name: "REST-flow-group" });
    const teacherId = await create("teachers", { name: "REST-flow-teacher" });
    const disciplineId = await create("disciplines", { name: "REST-flow-discipline" });
    const lessonTypeId = await create("lesson-types", { name: "REST-flow-type", color: "#0F766E" });
    const periodId = await create("periods", { number: 89, startTime: "21:00", endTime: "22:00", color: "#0F766E" });
    const value = { disciplineId, lessonTypeId, periodId, dayOfWeek: 1, weekPattern: "both", groupIds: [groupId], teacherIds: [teacherId], roomIds: [] };
    const entryId = await create("entries", value);
    expect((await call("entries", "POST", value)).response.status).toBe(422);
    expect((await call(`periods/${periodId}`, "DELETE")).response.status).toBe(409);
    expect((await call(`entries/${entryId}`, "PUT", { ...value, note: "Updated through API" })).response.status).toBe(200);
    const exceptionId = await create("exceptions", { kind: "cancel", baseEntryId: entryId, originalDate: "2026-09-07", reason: "REST QA" });
    expect((await call(`entries/${entryId}`, "DELETE")).response.status).toBe(409);
    expect((await call(`exceptions/${exceptionId}`, "PUT", { kind: "cancel", baseEntryId: entryId, originalDate: "2026-09-07", reason: "Changed" })).response.status).toBe(200);
    expect((await call(`exceptions/${exceptionId}`, "DELETE")).response.status).toBe(200);
    expect((await call(`entries/${entryId}`, "PATCH", { isActive: false })).response.status).toBe(200);
    const secondId = await create("entries", value);
    expect((await call(`entries/${entryId}`, "PATCH", { isActive: true })).response.status).toBe(422);
    expect((await call(`entries/${secondId}`, "DELETE")).response.status).toBe(200);
    expect((await call(`entries/${entryId}`, "DELETE")).response.status).toBe(200);
    expect((await call(`periods/${periodId}`, "DELETE")).response.status).toBe(200);
  }, 60_000);
  it("preserves calendar optimistic versions and writes week settings", async () => {
    const path = "calendar-overrides/2031-02-01";
    expect((await call(path, "PUT", { dayOfWeek: 1, weekType: "numerator", version: 0 })).response.status).toBe(200);
    const current = (await call(path)).body.data;
    expect((await call(path, "PUT", { dayOfWeek: 2, weekType: "denominator", version: 0 })).response.status).toBe(422);
    expect((await call(`${path}?version=${current.version}`, "DELETE")).response.status).toBe(200);
    expect((await call("week-settings", "PUT", { anchorDate: "2026-09-01", anchorWeekType: "numerator", semesterStart: "2026-09-01", semesterEnd: "2026-12-31" })).response.status).toBe(200);
    expect((await call("week-settings")).body.data.semesterEnd).toBe("2026-12-31");
    expect((await call("schedule?date=2026-09-07")).response.status).toBe(200);
  }, 30_000);
  it("previews and commits the existing JSON import format idempotently", async () => {
    const records = [{ teacher: "REST Import Teacher", date: "2026-09-04", dayOfWeek: 5, period: 1, weekType: "numerator", subject: "REST Import Subject", room: "REST-101", groups: ["REST-IMP"], lessonType: "Лекція", substitution: { dayOfWeek: 1, weekType: "numerator" } }];
    expect((await call("imports/preview", "POST", { records })).body.data.canCommit).toBe(true);
    expect((await call("imports/commit", "POST", { records })).body.data.createdCount).toBe(1);
    expect((await call("imports/commit", "POST", { records })).body.data.skippedCount).toBe(1);
  }, 60_000);
});
