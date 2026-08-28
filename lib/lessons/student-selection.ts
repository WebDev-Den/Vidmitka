export type LessonStudentSelection = { groupNames: string[]; studentIds: string[] };
export type LessonStudentSelectionInput = { groupNames: unknown; studentIds: unknown };

export function validateLessonStudentSelection(input: LessonStudentSelectionInput, requireStudents = false):
  { ok: true; value: LessonStudentSelection } | { ok: false; message: string } {
  if (!Array.isArray(input.groupNames) || input.groupNames.length > 100
    || input.groupNames.some((name: unknown) => typeof name !== "string" || name.length < 2 || name.length > 100)
    || new Set(input.groupNames).size !== input.groupNames.length) {
    return { ok: false, message: "Оберіть навчальні групи без повторень (до 100 груп)." };
  }
  if (!Array.isArray(input.studentIds) || input.studentIds.length > 5000
    || input.studentIds.some((id: unknown) => typeof id !== "string" || !/^[1-9]\d{0,17}$/u.test(id))
    || new Set(input.studentIds).size !== input.studentIds.length) {
    return { ok: false, message: "Оберіть не більше 5000 студентів без повторень." };
  }
  if (input.studentIds.length > 0 && input.groupNames.length === 0) {
    return { ok: false, message: "Оберіть групи вибраних студентів." };
  }
  if (requireStudents && input.studentIds.length === 0) {
    return { ok: false, message: "Оберіть хоча б одного студента для додавання." };
  }
  return { ok: true, value: { groupNames: input.groupNames, studentIds: input.studentIds } };
}
