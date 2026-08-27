import { describe, expect, it } from "vitest";

import {
  getWeekTypeForDate,
  lessonAppliesToWeek,
  validateScheduleWeekSettings,
} from "./rules";

describe("getWeekTypeForDate", () => {
  it("чергує чисельник і знаменник від опорного понеділка", () => {
    const settings = {
      anchorDate: "2026-08-31",
      anchorWeekType: "numerator" as const,
    };

    expect(getWeekTypeForDate("2026-09-02", settings)).toBe("numerator");
    expect(getWeekTypeForDate("2026-09-07", settings)).toBe("denominator");
    expect(getWeekTypeForDate("2026-09-14", settings)).toBe("numerator");
    expect(getWeekTypeForDate("2026-08-24", settings)).toBe("denominator");
  });

  it("заняття обох тижнів належить і чисельнику, і знаменнику", () => {
    expect(lessonAppliesToWeek("both", "numerator")).toBe(true);
    expect(lessonAppliesToWeek("both", "denominator")).toBe(true);
    expect(lessonAppliesToWeek("numerator", "numerator")).toBe(true);
    expect(lessonAppliesToWeek("numerator", "denominator")).toBe(false);
    expect(lessonAppliesToWeek("denominator", "denominator")).toBe(true);
    expect(lessonAppliesToWeek("denominator", "numerator")).toBe(false);
  });

  it("приймає опорну дату лише з понеділка", () => {
    expect(
      validateScheduleWeekSettings({
        anchorDate: "2026-08-31",
        anchorWeekType: "numerator",
      }),
    ).toEqual({
      ok: true,
      value: { anchorDate: "2026-08-31", anchorWeekType: "numerator" },
    });

    expect(
      validateScheduleWeekSettings({
        anchorDate: "2026-09-01",
        anchorWeekType: "numerator",
      }),
    ).toEqual({
      ok: false,
      message: "Опорна дата має бути понеділком.",
    });
  });
});
