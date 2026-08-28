import { describe, expect, it } from "vitest";
import { resolveScheduleWeekView, scheduleWeekHref } from "./view";

describe("перемикання перегляду навчального тижня", () => {
  it.each(["numerator", "denominator", null] as const)("без вибору зберігає календарний тип %s", (week) => {
    expect(resolveScheduleWeekView(week)).toEqual({ weekType: week, isPreview: false, invalidWeek: false });
  });
  it.each(["numerator", "denominator"] as const)("збіг із календарем %s не є попереднім переглядом", (week) => {
    expect(resolveScheduleWeekView(week, week)).toEqual({ weekType: week, isPreview: false, invalidWeek: false });
  });
  it("відрізняє ручний знаменник від фактичного чисельника", () => {
    expect(resolveScheduleWeekView("numerator", "denominator")).toEqual({ weekType: "denominator", isPreview: true, invalidWeek: false });
  });
  it("відрізняє ручний чисельник від фактичного знаменника", () => {
    expect(resolveScheduleWeekView("denominator", "numerator")).toEqual({ weekType: "numerator", isPreview: true, invalidWeek: false });
  });
  it.each(["numerator", "denominator"] as const)("дозволяє лише перегляд %s без налаштованого календаря", (week) => {
    expect(resolveScheduleWeekView(null, week)).toEqual({ weekType: week, isPreview: true, invalidWeek: false });
  });
  it.each(["both", "", "NUMERATOR", " numerator ", "unknown", ["numerator"], ["numerator", "denominator"], {}, null, 1])("не приймає некоректний або повторений параметр %#", (value) => {
    expect(resolveScheduleWeekView("denominator", value)).toEqual({ weekType: "denominator", isPreview: false, invalidWeek: true });
  });
  it.each(["/schedule", "/dashboard/schedule"] as const)("зберігає шлях %s і дату в URL", (path) => {
    expect(scheduleWeekHref(path, "2026-08-28", "numerator")).toBe(`${path}?date=2026-08-28&week=numerator`);
  });
  it("кодує дату як одне значення, а не нові параметри", () => {
    const url = new URL(scheduleWeekHref("/schedule", "2026-08-28&week=denominator", "numerator"), "https://example.test");
    expect(url.searchParams.getAll("week")).toEqual(["numerator"]);
    expect(url.searchParams.get("date")).toBe("2026-08-28&week=denominator");
  });
});
