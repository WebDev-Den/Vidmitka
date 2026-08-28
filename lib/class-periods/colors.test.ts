import { describe, expect, it } from "vitest";

import { PERIOD_COLORS, parsePeriodColor, periodColorForeground } from "./colors";

function luminance(hex: string): number {
  const [red, green, blue] = [1, 3, 5].map((offset) => {
    const channel = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

describe("палітра пар", () => {
  it("приймає і нормалізує всі доступні адміністратору кольори", () => {
    for (const color of PERIOD_COLORS) {
      expect(parsePeriodColor(` ${color.value.toLowerCase()} `)).toBe(color.value);
    }
  });

  it.each([undefined, null, 123, {}, "", "#fff", "#A855F7", "red", "url(test)"])(
    "не пропускає стороннє значення %s", (color) => expect(parsePeriodColor(color)).toBeNull(),
  );

  it("номери мають контраст не менше 4.5:1 на кожному дозволеному кольорі", () => {
    for (const color of PERIOD_COLORS) {
      const levels = [luminance(color.value), luminance(periodColorForeground(color.value))].sort((a, b) => b - a);
      expect((levels[0] + 0.05) / (levels[1] + 0.05)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
