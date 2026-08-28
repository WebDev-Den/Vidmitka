import { describe, expect, it } from "vitest";
import { validateLessonStudentSelection } from "./student-selection";

const selection = { groupNames: ["КН-21"], studentIds: ["1"] };
describe("необов’язковий список та пізніше додавання", () => {
  it("дозволяє порожній список лише при створенні заняття", () => {
    expect(validateLessonStudentSelection({ groupNames: [], studentIds: [] }).ok).toBe(true);
    expect(validateLessonStudentSelection({ groupNames: [], studentIds: [] }, true).ok).toBe(false);
  });
  it("не змінює передані значення", () => {
    expect(validateLessonStudentSelection(selection, true)).toEqual({ ok: true, value: selection });
  });
  it.each([
    { groupNames: null }, { groupNames: undefined }, { groupNames: "КН-21" }, { groupNames: [] },
    { groupNames: ["КН-21", "КН-21"] }, { groupNames: [1] }, { groupNames: [""] },
    { studentIds: null }, { studentIds: undefined }, { studentIds: "1" }, { studentIds: [1] },
    { studentIds: ["0"] }, { studentIds: ["-1"] }, { studentIds: ["1", "1"] }, { studentIds: ["1".repeat(19)] },
    { studentIds: Array.from({ length: 5001 }, (_, i) => String(i + 1)) },
    { groupNames: Array.from({ length: 101 }, (_, i) => `КН-${i}`) },
  ])("відхиляє некоректний вибір %#", (invalid) => {
    expect(validateLessonStudentSelection({ ...selection, ...invalid }).ok).toBe(false);
  });
});
