import { validateScheduleWeekSettings } from "@/lib/schedule-week/rules";
import type { ScheduledLesson } from "./schedule";

export type SchedulePath = "/schedule" | "/dashboard/schedule";

/** Calendar keys are dates, not instants in the browser's time zone. */
export function calendarDate(date: string): Date {
  return new Date(`${date}T12:00:00.000Z`);
}

export function calendarDateKey(date: Date): string | null {
  if (!Number.isFinite(date.getTime())) return null;
  const key = date.toISOString().slice(0, 10);
  return validateScheduleWeekSettings({ numeratorDate: key }).ok ? key : null;
}

export function shiftScheduleDate(date: string, offset: number): string | null {
  if (!validateScheduleWeekSettings({ numeratorDate: date }).ok || !Number.isInteger(offset)) return null;
  const shifted = calendarDate(date);
  shifted.setUTCDate(shifted.getUTCDate() + offset);
  return calendarDateKey(shifted);
}

/** Choosing a date always restores its actual calendar week, not a manual preview. */
export function scheduleDateHref(path: SchedulePath, date: string): string {
  return `${path}?${new URLSearchParams({ date }).toString()}`;
}

export function formatScheduleDate(date: string): string {
  return new Intl.DateTimeFormat("uk-UA", {
    timeZone: "UTC", day: "numeric", month: "long", year: "numeric",
  }).format(calendarDate(date));
}

export function groupScheduleLessons(lessons: readonly ScheduledLesson[]) {
  const groups = new Map<string, {
    key: string; number: number; startMinute: number; endMinute: number; lessons: ScheduledLesson[];
  }>();
  for (const lesson of lessons) {
    const key = `${lesson.periodNumber}:${lesson.startMinute}:${lesson.endMinute}`;
    let group = groups.get(key);
    if (!group) {
      group = { key, number: lesson.periodNumber, startMinute: lesson.startMinute, endMinute: lesson.endMinute, lessons: [] };
      groups.set(key, group);
    }
    group.lessons.push(lesson);
  }
  return Array.from(groups.values()).sort((a, b) => a.startMinute - b.startMinute || a.number - b.number);
}
