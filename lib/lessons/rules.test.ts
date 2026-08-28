import { describe, expect, it } from "vitest";
import { validateLessonDraft } from "./rules";
const draft = { subjectId: "1", roomId: "2", classPeriodId: "3", lessonTypeId: "1", dayOfWeek: "4", weekType: "both", groupNames: ["КН-21"], studentIds: ["4", "5"] };
describe("створення заняття зі студентами", () => {
  it("приймає довідники та точний список", () => expect(validateLessonDraft(draft)).toMatchObject({ ok: true, value: { ...draft, dayOfWeek: 4 } }));
  it.each([
    { subjectId: "bad" }, { roomId: "0" }, { classPeriodId: "" }, { dayOfWeek: "8" },
    { lessonTypeId: "" }, { lessonTypeId: "lecture" }, { lessonTypeId: null },
    { dayOfWeek: "1.5" }, { weekType: "sometimes" }, { studentIds: [] }, { groupNames: [] },
    { studentIds: ["4", "4"] }, { studentIds: ["-1"] }, { groupNames: ["КН-21", "КН-21"] },
  ])("відхиляє неправильні дані %#", (value) => expect(validateLessonDraft({ ...draft, ...value }).ok).toBe(false));
});
