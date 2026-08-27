import { describe, expect, it } from "vitest";

import {
  getDateKeyInTimeZone,
  getNumeratorAnchorDate,
  getWeekStartDate,
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

  it.each(["2026-08-31", "2026-09-02", "2026-09-06"])(
    "визначає однаковий тип усього тижня для дати чисельника %s",
    (anchorDate) => {
      const settings = { anchorDate, anchorWeekType: "numerator" as const };

      expect(getWeekTypeForDate("2026-08-30", settings)).toBe("denominator");
      expect(getWeekTypeForDate("2026-08-31", settings)).toBe("numerator");
      expect(getWeekTypeForDate("2026-09-06", settings)).toBe("numerator");
      expect(getWeekTypeForDate("2026-09-07", settings)).toBe("denominator");
      expect(getWeekTypeForDate("2026-09-13", settings)).toBe("denominator");
      expect(getWeekTypeForDate("2026-09-14", settings)).toBe("numerator");
    },
  );

  it("не скидає чергування на межі року або високосного лютого", () => {
    const newYear = { anchorDate: "2020-12-31", anchorWeekType: "numerator" as const };
    expect(getWeekTypeForDate("2021-01-03", newYear)).toBe("numerator");
    expect(getWeekTypeForDate("2021-01-04", newYear)).toBe("denominator");
    expect(getWeekTypeForDate("2021-01-11", newYear)).toBe("numerator");

    const leapYear = { anchorDate: "2028-02-29", anchorWeekType: "numerator" as const };
    expect(getWeekTypeForDate("2028-02-28", leapYear)).toBe("numerator");
    expect(getWeekTypeForDate("2028-03-05", leapYear)).toBe("numerator");
    expect(getWeekTypeForDate("2028-03-06", leapYear)).toBe("denominator");
  });

  it("змінює тиждень опівночі понеділка за Києвом, включно з переходом часу", () => {
    const settings = { anchorDate: "2026-03-25", anchorWeekType: "numerator" as const };
    const sunday = getDateKeyInTimeZone(new Date("2026-03-29T20:59:59Z"));
    const monday = getDateKeyInTimeZone(new Date("2026-03-29T21:00:00Z"));
    expect(sunday).toBe("2026-03-29");
    expect(monday).toBe("2026-03-30");
    expect(getWeekTypeForDate(sunday, settings)).toBe("numerator");
    expect(getWeekTypeForDate(monday, settings)).toBe("denominator");

    const autumn = { anchorDate: "2026-10-21", anchorWeekType: "numerator" as const };
    expect(getWeekTypeForDate(getDateKeyInTimeZone(new Date("2026-10-25T21:59:59Z")), autumn)).toBe("numerator");
    expect(getWeekTypeForDate(getDateKeyInTimeZone(new Date("2026-10-25T22:00:00Z")), autumn)).toBe("denominator");
  });

  it("зберігає чергування попереднього налаштування знаменника", () => {
    const previous = { anchorDate: "2026-08-31", anchorWeekType: "denominator" as const };
    const numeratorDate = getNumeratorAnchorDate(previous);
    expect(numeratorDate).toBe("2026-09-07");
    const next = validateScheduleWeekSettings({ numeratorDate });
    expect(next.ok).toBe(true);
    if (!next.ok) throw new Error(next.message);
    for (const date of ["2026-08-24", "2026-08-31", "2026-09-07", "2027-01-01"]) {
      expect(getWeekTypeForDate(date, next.value)).toBe(getWeekTypeForDate(date, previous));
    }
  });
});

describe("validateScheduleWeekSettings", () => {
  it.each(["2026-08-31", "2026-09-02", "2026-09-06", "2028-02-29"])(
    "приймає дату %s без ручного вибору типу та зберігає її",
    (numeratorDate) => {
      expect(validateScheduleWeekSettings({ numeratorDate })).toEqual({
        ok: true,
        value: { anchorDate: numeratorDate, anchorWeekType: "numerator" },
      });
    },
  );

  it.each([null, "", "2026-02-29", "2026-04-31", "2026-13-01", "01.09.2026", "0000-01-01", "2026-09-01T00:00:00Z"])(
    "відхиляє некоректну дату %s",
    (numeratorDate) => {
      expect(validateScheduleWeekSettings({ numeratorDate }).ok).toBe(false);
    },
  );

  it("не приймає файл замість дати", () => {
    expect(validateScheduleWeekSettings({ numeratorDate: new File(["2026-09-01"], "date.txt") }).ok).toBe(false);
  });

  it("знаходить понеділок без зміни вибраної дати чисельника", () => {
    const settings = { anchorDate: "2026-09-02", anchorWeekType: "numerator" as const };
    expect(getNumeratorAnchorDate(settings)).toBe("2026-09-02");
    expect(getWeekStartDate(settings.anchorDate)).toBe("2026-08-31");
    expect(getWeekStartDate("2026-09-06")).toBe("2026-08-31");
  });
});
