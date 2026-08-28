import { describe, expect, it } from "vitest";

import { validateClassPeriod } from "./rules";

const existingPeriods = [
  {
    id: "period-1",
    number: 1,
    startMinute: 8 * 60,
    endMinute: 9 * 60 + 20,
    isActive: true,
  },
];

describe("validateClassPeriod", () => {
  it("нормалізує коректний номер пари та часові межі", () => {
    expect(
      validateClassPeriod(
        { number: "2", startTime: "09:35", endTime: "10:55", color: " #48c5b5 " },
        existingPeriods,
      ),
    ).toEqual({
      ok: true,
      value: {
        number: 2,
        startMinute: 575,
        endMinute: 655,
        color: "#48C5B5",
      },
    });
  });

  it("не дозволяє завершення раніше або одночасно з початком", () => {
    const result = validateClassPeriod(
      { number: "2", startTime: "10:55", endTime: "10:55", color: "#0F766E" },
      existingPeriods,
    );

    expect(result).toEqual({
      ok: false,
      message: "Час завершення має бути пізніше за час початку.",
    });
  });

  it("не дозволяє дублювати номер іншої пари", () => {
    const result = validateClassPeriod(
      { number: "1", startTime: "09:35", endTime: "10:55", color: "#0F766E" },
      existingPeriods,
    );

    expect(result).toEqual({
      ok: false,
      message: "Пара з номером 1 уже існує.",
    });
  });

  it("не дозволяє активним парам перетинатися в часі", () => {
    const result = validateClassPeriod(
      { number: "2", startTime: "09:00", endTime: "10:20", color: "#0F766E" },
      existingPeriods,
    );

    expect(result).toEqual({
      ok: false,
      message: "Час перетинається з 1 парою (08:00–09:20).",
    });
  });

  it("під час редагування не порівнює пару саму із собою", () => {
    expect(
      validateClassPeriod(
        { number: "1", startTime: "08:05", endTime: "09:25", color: "#0F766E" },
        existingPeriods,
        "period-1",
      ),
    ).toEqual({
      ok: true,
      value: {
        number: 1,
        startMinute: 485,
        endMinute: 565,
        color: "#0F766E",
      },
    });
  });

  it.each([null, "", "purple", "#A855F7", "#fff", "url(https://example.test)"])(
    "відхиляє колір поза затвердженою палітрою: %s",
    (color) => {
      expect(validateClassPeriod(
        { number: "2", startTime: "09:35", endTime: "10:55", color },
        existingPeriods,
      )).toEqual({ ok: false, message: "Оберіть колір пари з палітри сайту." });
    },
  );
});
