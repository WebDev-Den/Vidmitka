import type { LessonWeekType } from "@/lib/schedule-week/rules";

export const LESSON_DAYS = ["Понеділок", "Вівторок", "Середа", "Четвер", "П’ятниця", "Субота", "Неділя"];
export type LessonDraft = {
  subjectId: string; roomId: string; classPeriodId: string; lessonTypeId: string; dayOfWeek: number;
  weekType: LessonWeekType; groupNames: string[]; studentIds: string[];
};
export type LessonInput = { [Key in keyof LessonDraft]: unknown };
const id = (value: unknown): value is string => typeof value === "string" && /^[1-9]\d{0,17}$/u.test(value);
export function validateLessonDraft(input: LessonInput): { ok: true; value: LessonDraft } | { ok: false; message: string } {
  if (!id(input.subjectId) || !id(input.roomId) || !id(input.classPeriodId)) return { ok: false, message: "Оберіть предмет, аудиторію та пару з довідників." };
  if (!id(input.lessonTypeId)) return { ok: false, message: "Оберіть тип заняття з довідника." };
  if (typeof input.dayOfWeek !== "string" || !/^[1-7]$/u.test(input.dayOfWeek)) return { ok: false, message: "Оберіть день тижня." };
  if (!["numerator", "denominator", "both"].includes(String(input.weekType))) return { ok: false, message: "Оберіть тип навчального тижня." };
  if (!Array.isArray(input.groupNames) || !input.groupNames.length || input.groupNames.length > 100
    || input.groupNames.some((name: unknown) => typeof name !== "string" || name.length < 2 || name.length > 100)
    || new Set(input.groupNames).size !== input.groupNames.length) return { ok: false, message: "Оберіть навчальні групи без повторень." };
  if (!Array.isArray(input.studentIds) || !input.studentIds.length || input.studentIds.length > 5000
    || input.studentIds.some((value: unknown) => !id(value)) || new Set(input.studentIds).size !== input.studentIds.length) {
    return { ok: false, message: "Оберіть від 1 до 5000 студентів без повторень." };
  }
  return { ok: true, value: { subjectId: input.subjectId, roomId: input.roomId, classPeriodId: input.classPeriodId, lessonTypeId: input.lessonTypeId,
    dayOfWeek: Number(input.dayOfWeek), weekType: input.weekType as LessonWeekType, groupNames: input.groupNames, studentIds: input.studentIds } };
}
