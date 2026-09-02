export type CalendarWeekType = "numerator" | "denominator";

export type CalendarDayContext = Readonly<{
  date: string;
  calendarDayOfWeek: number;
  dayOfWeek: number;
  weekType: CalendarWeekType | null;
  isOverride: boolean;
  token: string;
}>;

export type CalendarOverride = Readonly<{
  date: string;
  dayOfWeek: number;
  weekType: CalendarWeekType;
  version: number;
  hasJournal: boolean;
}>;

type Validation<T> = { ok: true; value: T } | { ok: false; message: string };
type DateVersionInput = Readonly<{
  date: FormDataEntryValue | null;
  version: FormDataEntryValue | null;
}>;

export type CalendarOverrideInput = DateVersionInput & Readonly<{
  dayOfWeek: FormDataEntryValue | null;
  weekType: FormDataEntryValue | null;
}>;

export const CALENDAR_DAY_LABELS = [
  "Понеділок",
  "Вівторок",
  "Середа",
  "Четвер",
  "П’ятниця",
  "Субота",
  "Неділя",
] as const;

export const REQUESTED_CALENDAR_OVERRIDES_2026 = [
  { date: "2026-09-04", dayOfWeek: 1, weekType: "numerator" },
  { date: "2026-09-11", dayOfWeek: 2, weekType: "numerator" },
  { date: "2026-09-18", dayOfWeek: 3, weekType: "numerator" },
  { date: "2026-09-25", dayOfWeek: 4, weekType: "numerator" },
  { date: "2026-10-02", dayOfWeek: 1, weekType: "denominator" },
  { date: "2026-10-09", dayOfWeek: 2, weekType: "denominator" },
  { date: "2026-10-16", dayOfWeek: 3, weekType: "denominator" },
  { date: "2026-10-23", dayOfWeek: 4, weekType: "denominator" },
  { date: "2026-10-30", dayOfWeek: 1, weekType: "numerator" },
  { date: "2026-11-06", dayOfWeek: 2, weekType: "numerator" },
  { date: "2026-11-13", dayOfWeek: 3, weekType: "numerator" },
  { date: "2026-11-20", dayOfWeek: 4, weekType: "numerator" },
] as const satisfies readonly Readonly<{
  date: string;
  dayOfWeek: number;
  weekType: CalendarWeekType;
}>[];

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

export function validateCalendarOverrideDateVersion(input: DateVersionInput): Validation<{
  date: string;
  version: number;
}> {
  const date = typeof input.date === "string" ? input.date.trim() : "";
  if (!isCalendarDate(date)) return { ok: false, message: "Вкажіть коректну дату перенесення." };
  if (typeof input.version !== "string" || !/^\d{1,9}$/u.test(input.version)) {
    return { ok: false, message: "Некоректна версія календаря. Оновіть сторінку." };
  }
  return { ok: true, value: { date, version: Number(input.version) } };
}

export function validateCalendarOverride(input: CalendarOverrideInput): Validation<{
  date: string;
  dayOfWeek: number;
  weekType: CalendarWeekType;
  version: number;
}> {
  const base = validateCalendarOverrideDateVersion(input);
  if (!base.ok) return base;
  if (typeof input.dayOfWeek !== "string" || !/^[1-7]$/u.test(input.dayOfWeek)) {
    return { ok: false, message: "Оберіть день, за розкладом якого проводяться заняття." };
  }
  if (input.weekType !== "numerator" && input.weekType !== "denominator") {
    return { ok: false, message: "Оберіть чисельник або знаменник." };
  }
  return {
    ok: true,
    value: { ...base.value, dayOfWeek: Number(input.dayOfWeek), weekType: input.weekType },
  };
}

export function calendarDayLabel(dayOfWeek: number): string {
  return CALENDAR_DAY_LABELS[dayOfWeek - 1] ?? "Невідомий день";
}

export function calendarWeekLabel(weekType: CalendarWeekType): string {
  return weekType === "numerator" ? "Чисельник" : "Знаменник";
}
