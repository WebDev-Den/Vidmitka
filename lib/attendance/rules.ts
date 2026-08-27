import { validateScheduleWeekSettings } from "@/lib/schedule-week/rules";

export const ATTENDANCE_LABELS = {
  unmarked: "Не відмічено",
  present: "Присутній",
  absent: "Відсутній",
  not_required: "Не потребує відмічання",
} as const;
export type AttendanceStatus = keyof typeof ATTENDANCE_LABELS;
export type AttendanceStudent = {
  studentId: string; fullName: string; groupName: string; subgroup: string; status: AttendanceStatus;
};
export function isAttendanceStatus(value: unknown): value is AttendanceStatus {
  return typeof value === "string" && Object.hasOwn(ATTENDANCE_LABELS, value);
}
export function isJournalDate(value: string): boolean {
  return validateScheduleWeekSettings({ numeratorDate: value }).ok;
}
export function attendanceSummary(rows: readonly Pick<AttendanceStudent, "status">[]) {
  const count = (status: AttendanceStatus) => rows.filter((row) => row.status === status).length;
  const present = count("present");
  const notRequired = count("not_required");
  const expected = rows.length - notRequired;
  return { total: rows.length, expected, present, absent: count("absent"), unmarked: count("unmarked"), notRequired,
    percentage: expected ? Math.round(present * 100 / expected) : null };
}
export function applyAudience(rows: readonly AttendanceStudent[], group: string, subgroup: string): AttendanceStudent[] {
  return rows.map((row) => {
    const included = (!group || row.groupName === group) && (!subgroup || row.subgroup === subgroup);
    return { ...row, status: included ? (row.status === "not_required" ? "unmarked" : row.status) : "not_required" };
  });
}
export function suggestedLessonId(lessons: readonly { key: string; startMinute: number; endMinute: number }[], minute: number): string | undefined {
  return (lessons.find((lesson) => lesson.startMinute <= minute && minute < lesson.endMinute)
    ?? lessons.find((lesson) => lesson.startMinute > minute) ?? lessons[0])?.key;
}
export function kyivMinute(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Kyiv", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  return Number(parts.find((part) => part.type === "hour")?.value) * 60 + Number(parts.find((part) => part.type === "minute")?.value);
}
