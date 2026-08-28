import { expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const cookie = vi.hoisted(() => ({ token: "" }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => cookie.token ? { value: cookie.token } : undefined }) }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import { createLessonDirectoryOption } from "@/app/(private)/dashboard/lessons/new/directory-actions";
import { createAuthSession } from "@/lib/auth/repository";
import { getDb } from "@/lib/db";
import { createSubject, listSubjects, setSubjectActive } from "@/lib/subjects/repository";
import { createRoom, listRooms, setRoomActive } from "@/lib/rooms/repository";
import { listLessonTypes, saveLessonType, setLessonTypeActive } from "@/lib/lesson-types/repository";

it.skipIf(!process.env.VIDMITKA_ATTENDANCE_TEST_SCHEMA)(
  "швидке створення: справжні ID, нормалізація, дублікати, права та старі контракти",
  async () => {
    const sql = getDb();
    const [scope] = await sql`SELECT current_schema() AS name` as unknown as { name: string }[];
    expect(scope.name).toBe(process.env.VIDMITKA_ATTENDANCE_TEST_SCHEMA);
    expect(scope.name).toMatch(/^codex_attendance_test_[0-9a-f]{16}$/u);
    cookie.token = (await createAuthSession("administrator")).token;

    const cases = [
      { kind: "subject", name: "Новий предмет", list: listSubjects, deactivate: (id: string) => setSubjectActive(id, false), invalid: ["", "А", "А".repeat(201)] },
      { kind: "room", name: "Нова аудиторія", list: listRooms, deactivate: (id: string) => setRoomActive(id, false), invalid: ["", " ", "А".repeat(101)] },
      { kind: "lessonType", name: "Новий тип", list: listLessonTypes, deactivate: (id: string) => setLessonTypeActive("administrator", id, false), invalid: ["", "А", "А".repeat(101), "Лек\u200bція"] },
    ] as const;
    for (const scenario of cases) {
      const initialCount = (await scenario.list()).length;
      for (const invalid of scenario.invalid) expect((await createLessonDirectoryOption(scenario.kind, invalid)).success).toBe(false);
      expect(await scenario.list()).toHaveLength(initialCount);
      const result = await createLessonDirectoryOption(scenario.kind, `  ${scenario.name.replace(" ", "   ")}  `);
      expect(result.success).toBe(true);
      if (!result.success) throw new Error(result.message);
      expect(result.option.id).toMatch(/^[1-9]\d*$/u);
      expect(result.option.name).toBe(scenario.name);
      expect(await scenario.list({ activeOnly: true })).toContainEqual({ ...result.option, isActive: true });
      expect((await createLessonDirectoryOption(scenario.kind, scenario.name)).success).toBe(false);
      await scenario.deactivate(result.option.id);
      expect((await createLessonDirectoryOption(scenario.kind, scenario.name)).success).toBe(false);
      expect(await scenario.list()).toHaveLength(initialCount + 1);
      expect(await scenario.list({ activeOnly: true })).not.toContainEqual({ ...result.option, isActive: true });
    }

    expect(await createSubject("Старий контракт предмета")).toEqual({ success: true, message: "Предмет «Старий контракт предмета» додано." });
    expect(await createRoom("Старий контракт аудиторії")).toEqual({ success: true, message: "Аудиторію «Старий контракт аудиторії» додано." });
    expect(await saveLessonType("administrator", { name: "Старий контракт типу" })).toEqual({ success: true, message: "Тип заняття додано." });
    const type = (await listLessonTypes()).find((item) => item.name === "Старий контракт типу");
    expect(type).toBeDefined();
    expect(await saveLessonType("administrator", { id: type!.id, name: "Оновлений тип" })).toEqual({ success: true, message: "Назву типу оновлено." });
    expect((await createLessonDirectoryOption("unknown", "Не створювати")).success).toBe(false);
    expect((await createLessonDirectoryOption("room", null)).success).toBe(false);

    const counts = await Promise.all(cases.map(async (scenario) => (await scenario.list()).length));
    cookie.token = (await createAuthSession("teacher")).token;
    for (const scenario of cases) await expect(createLessonDirectoryOption(scenario.kind, "Без дозволу")).rejects.toThrow("redirect:/dashboard?access=denied");
    await sql`UPDATE app_users SET approval_status = 'pending' WHERE id = 'other-teacher'`;
    cookie.token = (await createAuthSession("other-teacher")).token;
    for (const scenario of cases) await expect(createLessonDirectoryOption(scenario.kind, "Без схвалення")).rejects.toThrow("redirect:/approval-pending");
    cookie.token = "";
    for (const scenario of cases) await expect(createLessonDirectoryOption(scenario.kind, "Без сесії")).rejects.toThrow("redirect:/sign-in");
    expect(await Promise.all(cases.map(async (scenario) => (await scenario.list()).length))).toEqual(counts);
  },
  120000,
);
