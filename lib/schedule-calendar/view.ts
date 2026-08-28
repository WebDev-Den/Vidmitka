import type { AlternatingWeekType } from "@/lib/schedule-week/rules";

export type ScheduleWeekView = Readonly<{
  weekType: AlternatingWeekType | null;
  isPreview: boolean;
  invalidWeek: boolean;
}>;

export function resolveScheduleWeekView(calendarWeek: AlternatingWeekType | null, requestedWeek?: unknown): ScheduleWeekView {
  const selected = requestedWeek === "numerator" || requestedWeek === "denominator" ? requestedWeek : null;
  return {
    weekType: selected ?? calendarWeek,
    isPreview: selected !== null && selected !== calendarWeek,
    invalidWeek: requestedWeek !== undefined && selected === null,
  };
}

export function scheduleWeekHref(path: "/schedule" | "/dashboard/schedule", date: string, week: AlternatingWeekType): string {
  return `${path}?${new URLSearchParams({ date, week }).toString()}`;
}
