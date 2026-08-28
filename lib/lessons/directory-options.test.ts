import { describe, expect, it } from "vitest";
import { canOfferDirectoryCreation, isLessonDirectoryKind, matchesDirectoryQuery, mergeDirectoryOptions, normalizeDirectoryQuery } from "./directory-options";

const options = [{ id: "1", name: "Основи програмування" }, { id: "2", name: "Вища математика" }];

describe("пошук довідників заняття", () => {
  it("нормалізує пробіли й Unicode", () => {
    expect(normalizeDirectoryQuery("  Украі\u0308нська   мова  ")).toBe("Українська мова");
  });
  it.each(["ПРОГРАМ", " основи   програмування ", ""])("знаходить частину назви: %s", (query) => {
    expect(matchesDirectoryQuery(options[0], query)).toBe(true);
  });
  it("не повертає сторонню назву", () => {
    expect(matchesDirectoryQuery(options[0], "фізика")).toBe(false);
  });
  it("дозволяє додати окрему назву при частковому збігу, але не точний дублікат", () => {
    expect(canOfferDirectoryCreation("subject", "Основи", options)).toBe(true);
    expect(canOfferDirectoryCreation("subject", " ОСНОВИ   ПРОГРАМУВАННЯ ", options)).toBe(false);
  });
  it.each([
    ["subject", "А", false], ["subject", "А".repeat(200), true], ["subject", "А".repeat(201), false],
    ["room", "1", true], ["room", "А".repeat(100), true], ["room", "А".repeat(101), false],
    ["lessonType", "А", false], ["lessonType", "А".repeat(100), true], ["lessonType", "А".repeat(101), false],
    ["subject", "   ", false], ["lessonType", "Лек\u200bція", false],
  ] as const)("обмеження назви %s / %s", (kind, name, allowed) => {
    expect(canOfferDirectoryCreation(kind, name, [])).toBe(allowed);
  });
  it("зберігає локальні нові записи без дублювання після revalidation", () => {
    const created = [{ id: "1", name: "Стара назва" }, { id: "3", name: "Фізика" }];
    const merged = mergeDirectoryOptions(options, created);
    expect(merged).toHaveLength(3);
    expect(merged.find((option) => option.id === "1")).toEqual(options[0]);
    expect(merged.find((option) => option.id === "3")?.name).toBe("Фізика");
    expect(created[0].name).toBe("Стара назва");
    expect(options).toHaveLength(2);
  });
  it.each(["subject", "room", "lessonType"])("дозволений довідник %s", (kind) => {
    expect(isLessonDirectoryKind(kind)).toBe(true);
  });
  it.each([null, undefined, "", "teacher", "__proto__", {}, 1])("відхиляє невідомий довідник %s", (kind) => {
    expect(isLessonDirectoryKind(kind)).toBe(false);
  });
});
