import { describe, expect, it } from "vitest";
import { validateMakeupDay, validateMakeupDateVersion } from "./rules";

describe("календар відпрацювань", () => {
  const input = { date: "2026-09-04", dayOfWeek: "1", weekType: "numerator", version: "0" };

  it("приймає дату з прикладу: понеділок-чисельник замість календарної п'ятниці", () => {
    expect(validateMakeupDay(input)).toEqual({ ok: true, value: {
      date: "2026-09-04", dayOfWeek: 1, weekType: "numerator", version: 0,
    } });
  });

  it.each(["2026-02-30", "0000-01-01", "04.09.2026", "2026-9-4", ""])(
    "відхиляє некоректну дату %s", (date) => {
      expect(validateMakeupDay({ ...input, date }).ok).toBe(false);
    },
  );

  it.each(["0", "8", "1.5", "понеділок", null])("відхиляє день поза переліком: %s", (dayOfWeek) => {
    expect(validateMakeupDay({ ...input, dayOfWeek }).ok).toBe(false);
  });

  it("не дозволяє обидва тижні як тип календарної дати", () => {
    expect(validateMakeupDay({ ...input, weekType: "both" }).ok).toBe(false);
  });

  it("приймає високосну дату й версію редагування", () => {
    expect(validateMakeupDay({ ...input, date: "2028-02-29", dayOfWeek: "7", weekType: "denominator", version: "12" }))
      .toEqual({ ok: true, value: { date: "2028-02-29", dayOfWeek: 7, weekType: "denominator", version: 12 } });
  });

  it.each(["-1", "1.1", "9999999999999999", "", null])("не приймає неправильну версію: %s", (version) => {
    expect(validateMakeupDateVersion({ date: input.date, version }).ok).toBe(false);
  });
});
