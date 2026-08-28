import type { LessonWeekType } from "@/lib/schedule-week/rules";
import { validateLessonStudentSelection } from "./student-selection";

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
  const selection = validateLessonStudentSelection(input);
  if (!selection.ok) return selection;
  return { ok: true, value: { subjectId: input.subjectId, roomId: input.roomId, classPeriodId: input.classPeriodId, lessonTypeId: input.lessonTypeId,
    dayOfWeek: Number(input.dayOfWeek), weekType: input.weekType as LessonWeekType, ...selection.value } };
}
