import { describe, expect, it } from "vitest";

import {
  REQUESTED_CALENDAR_OVERRIDES_2026,
  validateCalendarOverride,
} from "./calendar-override-rules";

describe("calendar override rules", () => {
  it("keeps the twelve requested 2026 transfers exactly", () => {
    expect(REQUESTED_CALENDAR_OVERRIDES_2026).toEqual([
      { date: "2026-09-04", dayOfWeek: 1, weekType: "numerator" },
      { date: "2026-09-11", dayOfWeek: 2, weekType: "numerator" },
      { date: "2026-09-18", dayOfWeek: 3, weekType: "numerator" },
      { date: "2026-09-25", dayOfWeek: 4, weekType: "numerator" },
      { date: "2026-10-02", dayOfWeek: 1, weekType: "denominator" },
      { date: "2026-10-09", dayOfWeek: 2, weekType: "denominator" },
      { date: "2026-10-16", dayOfWeek: 3, weekType: "denominator" },
      { date: "2026-10-23", dayOfWeek: 4, weekType: "denominator" },
      { date: "2026-10-30", dayOfWeek: 1, weekType: "numerator" },
      { date: "2026-11-06", dayOfWeek: 2, weekType: "numerator" },
      { date: "2026-11-13", dayOfWeek: 3, weekType: "numerator" },
      { date: "2026-11-20", dayOfWeek: 4, weekType: "numerator" },
    ]);
  });

  it("accepts a complete calendar override", () => {
    expect(validateCalendarOverride({
      date: "2026-09-04",
      dayOfWeek: "1",
      weekType: "numerator",
      version: "0",
    })).toEqual({
      ok: true,
      value: { date: "2026-09-04", dayOfWeek: 1, weekType: "numerator", version: 0 },
    });
  });

  it("rejects an invalid date, day, week type or version", () => {
    expect(validateCalendarOverride({ date: "2026-02-30", dayOfWeek: "1", weekType: "numerator", version: "0" }).ok).toBe(false);
    expect(validateCalendarOverride({ date: "2026-09-04", dayOfWeek: "8", weekType: "numerator", version: "0" }).ok).toBe(false);
    expect(validateCalendarOverride({ date: "2026-09-04", dayOfWeek: "1", weekType: "both", version: "0" }).ok).toBe(false);
    expect(validateCalendarOverride({ date: "2026-09-04", dayOfWeek: "1", weekType: "numerator", version: "-1" }).ok).toBe(false);
  });
});
