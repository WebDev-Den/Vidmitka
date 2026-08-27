export type AlternatingWeekType = "numerator" | "denominator";
export type LessonWeekType = AlternatingWeekType | "both";

export type ScheduleWeekSettings = Readonly<{
  anchorDate: string;
  anchorWeekType: AlternatingWeekType;
}>;

const MILLISECONDS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

export type ScheduleWeekSettingsValidation =
  | Readonly<{ ok: true; value: ScheduleWeekSettings }>
  | Readonly<{ ok: false; message: string }>;

function dateValue(date: string): number {
  return Date.parse(`${date}T00:00:00.000Z`);
}

export function getWeekTypeForDate(
  date: string,
  settings: ScheduleWeekSettings,
): AlternatingWeekType {
  const weeksFromAnchor = Math.floor(
    (dateValue(date) - dateValue(settings.anchorDate)) / MILLISECONDS_PER_WEEK,
  );
  const isEvenWeek = ((weeksFromAnchor % 2) + 2) % 2 === 0;

  if (isEvenWeek) return settings.anchorWeekType;
  return settings.anchorWeekType === "numerator" ? "denominator" : "numerator";
}

export function lessonAppliesToWeek(
  lessonWeekType: LessonWeekType,
  currentWeekType: AlternatingWeekType,
): boolean {
  return lessonWeekType === "both" || lessonWeekType === currentWeekType;
}

export function validateScheduleWeekSettings(input: {
  anchorDate: FormDataEntryValue | null;
  anchorWeekType: FormDataEntryValue | null;
}): ScheduleWeekSettingsValidation {
  const anchorDate =
    typeof input.anchorDate === "string" ? input.anchorDate.trim() : "";
  const anchorWeekType = input.anchorWeekType;
  const parsedDate = dateValue(anchorDate);

  if (
    !DATE_PATTERN.test(anchorDate) ||
    !Number.isFinite(parsedDate) ||
    new Date(parsedDate).toISOString().slice(0, 10) !== anchorDate
  ) {
    return { ok: false, message: "Вкажіть коректну опорну дату." };
  }

  if (new Date(parsedDate).getUTCDay() !== 1) {
    return { ok: false, message: "Опорна дата має бути понеділком." };
  }

  if (anchorWeekType !== "numerator" && anchorWeekType !== "denominator") {
    return {
      ok: false,
      message: "Оберіть чисельник або знаменник для опорного тижня.",
    };
  }

  return { ok: true, value: { anchorDate, anchorWeekType } };
}

export function formatWeekTypeLabel(type: AlternatingWeekType): string {
  return type === "numerator" ? "Чисельник" : "Знаменник";
}

export function getDateKeyInTimeZone(
  date: Date,
  timeZone = "Europe/Kyiv",
): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}
