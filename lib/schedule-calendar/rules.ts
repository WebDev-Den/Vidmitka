import { validateScheduleWeekSettings, type AlternatingWeekType } from "@/lib/schedule-week/rules";

export type ScheduleDayContext = Readonly<{
  date: string;
  calendarDayOfWeek: number;
  dayOfWeek: number;
  weekType: AlternatingWeekType | null;
  isMakeup: boolean;
  token: string;
}>;

export type MakeupDay = Readonly<{
  date: string;
  dayOfWeek: number;
  weekType: AlternatingWeekType;
  version: number;
  hasJournal: boolean;
}>;

export type PublicMakeupDay = Pick<MakeupDay, "date" | "dayOfWeek" | "weekType">;

type DateVersion = Readonly<{ date: string; version: number }>;
type Validation<T> = { ok: true; value: T } | { ok: false; message: string };
type DateVersionInput = { date: FormDataEntryValue | null; version: FormDataEntryValue | null };
export type MakeupDayInput = DateVersionInput & {
  dayOfWeek: FormDataEntryValue | null;
  weekType: FormDataEntryValue | null;
};

export function validateMakeupDateVersion(input: DateVersionInput): Validation<DateVersion> {
  const date = typeof input.date === "string" ? input.date.trim() : "";
  if (!validateScheduleWeekSettings({ numeratorDate: date }).ok) {
    return { ok: false, message: "Вкажіть коректну дату відпрацювання." };
  }
  if (typeof input.version !== "string" || !/^\d{1,9}$/u.test(input.version)) {
    return { ok: false, message: "Некоректна версія календаря. Оновіть сторінку." };
  }
  return { ok: true, value: { date, version: Number(input.version) } };
}

export function validateMakeupDay(input: MakeupDayInput): Validation<DateVersion & {
  dayOfWeek: number; weekType: AlternatingWeekType;
}> {
  const base = validateMakeupDateVersion(input);
  if (!base.ok) return base;
  if (typeof input.dayOfWeek !== "string" || !/^[1-7]$/u.test(input.dayOfWeek)) {
    return { ok: false, message: "Оберіть день тижня, за розкладом якого проводяться заняття." };
  }
  if (input.weekType !== "numerator" && input.weekType !== "denominator") {
    return { ok: false, message: "Оберіть чисельник або знаменник для дати відпрацювання." };
  }
  return { ok: true, value: { ...base.value, dayOfWeek: Number(input.dayOfWeek), weekType: input.weekType } };
}
