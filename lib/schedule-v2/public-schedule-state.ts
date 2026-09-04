const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export const PUBLIC_TEACHER_COOKIE = "vidmitka_public_teacher";
export const PUBLIC_DATE_HANDOFF_STORAGE = "vidmitka_public_requested_date";

export type PublicNavigationDay = Readonly<{
  date: string;
  shortLabel: string;
  dayLabel: string;
}>;

type PublicScrollPeriod = Readonly<{
  number: number;
  startTime: string;
  endTime: string;
}>;

function timeToMinutes(value: string): number {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

export function isPublicDateKey(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

export function isPublicUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function addPublicScheduleDays(date: string, amount: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

export function publicNavigationWeek(date: string): PublicNavigationDay[] {
  const value = new Date(`${date}T00:00:00Z`);
  const mondayOffset = (value.getUTCDay() + 6) % 7;
  const monday = addPublicScheduleDays(date, -mondayOffset);

  return Array.from({ length: 7 }, (_, index) => {
    const itemDate = addPublicScheduleDays(monday, index);
    const item = new Date(`${itemDate}T00:00:00Z`);
    return {
      date: itemDate,
      shortLabel: new Intl.DateTimeFormat("uk-UA", { weekday: "short", timeZone: "UTC" }).format(item),
      dayLabel: new Intl.DateTimeFormat("uk-UA", { day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(item),
    };
  });
}

export function normalizePublicTeacherPreference(
  value: string | undefined,
  teachers: readonly Readonly<{ id: string }>[],
): string {
  if (!value || !isPublicUuid(value)) return "";
  return teachers.some((teacher) => teacher.id === value) ? value : "";
}

export function publicScheduleRequestUrl(input: { date: string; teacherId: string }): string {
  const query = new URLSearchParams({ date: input.date });
  if (input.teacherId) query.set("teacherId", input.teacherId);
  return `/api/public/schedule?${query.toString()}`;
}

export function publicScheduleScrollTarget(input: {
  periods: readonly PublicScrollPeriod[];
  date: string;
  currentDate: string;
  currentMinutes: number;
}): number | null {
  if (input.date !== input.currentDate || input.currentMinutes < 0 || input.periods.length === 0) {
    return null;
  }

  const current = input.periods.find((period) => {
    const start = timeToMinutes(period.startTime);
    const end = timeToMinutes(period.endTime);
    return input.currentMinutes >= start && input.currentMinutes <= end;
  });
  if (current) return current.number;

  const next = input.periods.find((period) => timeToMinutes(period.startTime) > input.currentMinutes);
  return next?.number ?? input.periods[input.periods.length - 1]?.number ?? null;
}
