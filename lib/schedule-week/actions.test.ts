import { beforeEach, describe, expect, it, vi } from "vitest";

const { authorize, sql, revalidate } = vi.hoisted(() => ({
  authorize: vi.fn(),
  sql: vi.fn(),
  revalidate: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ getDb: () => sql }));
vi.mock("@/lib/auth/session", () => ({ requireAdministrator: authorize }));
vi.mock("@/lib/semesters/repository", () => ({ endSemester: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: revalidate }));

import { saveWeekSettingsAction } from "@/app/(private)/dashboard/(admin)/settings/actions";
import { initialWeekSettingsActionState } from "@/app/(private)/dashboard/(admin)/settings/form-state";

import { getScheduleWeekSettings } from "./repository";
import { getWeekTypeForDate } from "./rules";

beforeEach(() => {
  vi.resetAllMocks();
  authorize.mockResolvedValue({ id: "administrator", role: "administrator" });
  sql.mockResolvedValue([]);
});

describe("збереження дати чисельника", () => {
  it("перевіряє адміністратора, зберігає дату та оновлює головну, розклади й журнал", async () => {
    const form = new FormData();
    form.set("numeratorDate", "2026-09-06");
    form.set("anchorWeekType", "denominator");

    const result = await saveWeekSettingsAction(initialWeekSettingsActionState, form);

    expect(result.success).toBe(true);
    expect(authorize).toHaveBeenCalledOnce();
    expect(sql).toHaveBeenCalledExactlyOnceWith(expect.any(Array), "2026-09-06", "numerator");
    expect(authorize.mock.invocationCallOrder[0]).toBeLessThan(sql.mock.invocationCallOrder[0]);
    expect(revalidate.mock.calls).toEqual([
      ["/"],
      ["/dashboard/settings"],
      ["/dashboard/schedule"],
      ["/dashboard/journal"],
      ["/schedule"],
    ]);
  });

  it.each(["anonymous", "teacher", "pending"])(
    "не змінює налаштування для користувача %s",
    async (role) => {
      authorize.mockRejectedValue(new Error(`access-denied:${role}`));
      const form = new FormData();
      form.set("numeratorDate", "2026-09-02");
      form.set("role", "administrator");

      await expect(saveWeekSettingsAction(initialWeekSettingsActionState, form))
        .rejects.toThrow(`access-denied:${role}`);
      expect(sql).not.toHaveBeenCalled();
      expect(revalidate).not.toHaveBeenCalled();
    },
  );

  it("не пише в БД порожню або неможливу дату", async () => {
    for (const date of ["", "2026-02-29"]) {
      const form = new FormData();
      form.set("numeratorDate", date);
      const result = await saveWeekSettingsAction(initialWeekSettingsActionState, form);
      expect(result.success).toBe(false);
    }
    expect(sql).not.toHaveBeenCalled();
    expect(revalidate).not.toHaveBeenCalled();
  });

  it("показує безпечну помилку, якщо збереження недоступне", async () => {
    sql.mockRejectedValue(new Error("internal connection details"));
    const form = new FormData();
    form.set("numeratorDate", "2026-09-02");
    const result = await saveWeekSettingsAction(initialWeekSettingsActionState, form);
    expect(result).toEqual({
      success: false,
      message: "Не вдалося зберегти дату чисельника. Спробуйте ще раз.",
    });
    expect(revalidate).not.toHaveBeenCalled();
  });

  it("читає збережену дату та використовує її для наступних тижнів", async () => {
    sql.mockResolvedValue([{ anchor_date: "2026-09-02", anchor_week_type: "numerator" }]);
    const settings = await getScheduleWeekSettings();
    expect(settings).toEqual({ anchorDate: "2026-09-02", anchorWeekType: "numerator" });
    expect(sql.mock.calls[0][0].join("")).toContain("anchor_date::text AS anchor_date");
    if (!settings) throw new Error("Missing settings");
    expect(getWeekTypeForDate("2026-09-06", settings)).toBe("numerator");
    expect(getWeekTypeForDate("2026-09-07", settings)).toBe("denominator");
  });

  it("не вигадує дату до налаштування адміністратором", async () => {
    expect(await getScheduleWeekSettings()).toBeNull();
  });
});
