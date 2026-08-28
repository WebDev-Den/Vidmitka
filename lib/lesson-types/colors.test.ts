import { describe, expect, it } from "vitest";
import { parseHexColor } from "@/lib/ui/colors";
import { lessonTypeAppearance } from "./colors";

describe("кольорові позначки типів занять", () => {
  it.each([
    ["#000000", "#FFFFFF"],
    ["#FFFFFF", "#18283D"],
    ["#808080", "#000000"],
    ["#0f766e", "#FFFFFF"],
  ])("залишає назву й контрастний текст на %s", (color, foreground) => {
    expect(lessonTypeAppearance("Лекція", color)).toEqual({
      label: "Лекція", background: color.toUpperCase(), foreground,
    });
  });

  it("нормалізує HEX без зміни відтінку", () => {
    expect(parseHexColor(" #abc123 ")).toBe("#ABC123");
  });

  it.each(["", "#FFF", "#12345678", "#ZZZZZZ", "red", "rgb(1,2,3)", "url(test)", null, 42, {}])(
    "не виводить сторонній CSS із кольору %#", (color) => {
      expect(parseHexColor(color)).toBeNull();
      expect(lessonTypeAppearance("Практична", color)).toEqual({
        label: "Практична", background: "#EFECE6", foreground: "#18283D",
      });
    },
  );

  it("заняття без типу має нейтральну позначку незалежно від кольору", () => {
    expect(lessonTypeAppearance(null, "#FF0000")).toEqual({
      label: "Тип не вказано", background: "#EFECE6", foreground: "#18283D",
    });
  });
});
