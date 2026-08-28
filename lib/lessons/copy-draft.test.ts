import { describe, expect, it } from "vitest";
import { prepareLessonCopy, type LessonCopySource } from "./copy-draft";

const source: LessonCopySource = {
  id: "12", teacherId: "teacher", subjectId: "2", subjectName: "Математика", roomId: "3", classPeriodId: "4",
  lessonTypeId: "5", dayOfWeek: 3, weekType: "numerator", studentIds: ["6", "7"], rosterMode: "selected",
};
const available = {
  teachers: [{ id: "teacher" }], subjects: [{ id: "2" }], rooms: [{ id: "3" }], periods: [{ id: "4" }],
  lessonTypes: [{ id: "5" }], students: [{ id: "6" }, { id: "7" }],
};

describe("чернетка копії заняття", () => {
  it("переносить параметри й студентів, але не ID, назву джерела або режим успадкування", () => {
    const result = prepareLessonCopy(source, available);
    expect(result).toEqual({ defaults: {
      teacherId: "teacher", subjectId: "2", roomId: "3", classPeriodId: "4", lessonTypeId: "5",
      dayOfWeek: 3, weekType: "numerator", studentIds: ["6", "7"],
    }, unavailableFields: [], omittedStudentCount: 0 });
    result.defaults.studentIds.push("8");
    expect(source.studentIds).toEqual(["6", "7"]);
  });

  it("очищує недоступні обов’язкові довідники з поясненням, а не вибирає перші", () => {
    const result = prepareLessonCopy(source, {
      ...available, teachers: [{ id: "administrator" }], subjects: [{ id: "99" }], rooms: [], periods: [], lessonTypes: [],
    });
    expect(result.unavailableFields).toEqual(["викладач", "предмет", "аудиторія", "пара", "тип заняття"]);
    expect(result.defaults).toMatchObject({ teacherId: "", subjectId: "", roomId: "", classPeriodId: "", lessonTypeId: "" });
  });

  it("просить вибрати тип для старого заняття без типу", () => {
    expect(prepareLessonCopy({ ...source, lessonTypeId: null }, available).unavailableFields).toEqual(["тип заняття"]);
  });

  it("не переносить недоступних студентів і не дублює вибір", () => {
    const result = prepareLessonCopy({ ...source, studentIds: ["6", "6", "7", "8"] }, { ...available, students: [{ id: "6" }] });
    expect(result.defaults.studentIds).toEqual(["6"]);
    expect(result.omittedStudentCount).toBe(2);
  });

  it.each(["numerator", "denominator", "both"] as const)("зберігає тиждень %s і порожній склад", (weekType) => {
    const result = prepareLessonCopy({ ...source, rosterMode: "subject", weekType, studentIds: [] }, available);
    expect(result.defaults.weekType).toBe(weekType);
    expect(result.defaults.studentIds).toEqual([]);
    expect(result.omittedStudentCount).toBe(0);
  });
});
