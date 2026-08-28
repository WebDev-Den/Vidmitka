import { describe, expect, it } from "vitest";

import { PERIOD_COLORS, parsePeriodColor, periodColorForeground } from "./colors";

function luminance(hex: string): number {
  const [red, green, blue] = [1, 3, 5].map((offset) => {
    const channel = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

describe("кольори пар", () => {
  it("приймає і нормалізує всі доступні адміністратору кольори", () => {
    for (const color of PERIOD_COLORS) {
      expect(parsePeriodColor(` ${color.value.toLowerCase()} `)).toBe(color.value);
    }
  });

  it.each(["#A855F7", "#123ABC", "#000000", "#FFFFFF", "#808080"])(
    "приймає довільний RGB-колір %s", (color) => {
      expect(parsePeriodColor(` ${color.toLowerCase()} `)).toBe(color);
    },
  );

  it.each([undefined, null, 123, {}, "", "#fff", "#12345G", "#12345678", "red", "transparent", "rgb(0, 0, 0)", "url(test)"])(
    "не пропускає стороннє значення %s", (color) => expect(parsePeriodColor(color)).toBeNull(),
  );

  it("номери мають контраст не менше 4.5:1 на кожному дозволеному кольорі", () => {
    for (const color of PERIOD_COLORS) {
      const levels = [luminance(color.value), luminance(periodColorForeground(color.value))].sort((a, b) => b - a);
      expect((levels[0] + 0.05) / (levels[1] + 0.05)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each([
    ["#000000", "#FFFFFF"],
    ["#FFFFFF", "#18283D"],
    ["#808080", "#000000"],
  ] as const)("вибирає читабельний номер для %s", (color, foreground) => {
    expect(periodColorForeground(color)).toBe(foreground);
  });

  it("забезпечує контраст для довільних і граничних RGB-відтінків", () => {
    for (const red of [0, 64, 117, 128, 192, 255]) {
      for (const green of [0, 64, 117, 128, 192, 255]) {
        for (const blue of [0, 64, 117, 128, 192, 255]) {
          const color = parsePeriodColor("#" + [red, green, blue].map((channel) => channel.toString(16).padStart(2, "0")).join(""))!;
          const levels = [luminance(color), luminance(periodColorForeground(color))].sort((a, b) => b - a);
          expect((levels[0] + 0.05) / (levels[1] + 0.05), color).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });
});
