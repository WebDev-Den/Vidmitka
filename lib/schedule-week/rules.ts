export type AlternatingWeekType = "numerator" | "denominator";
export type LessonWeekType = AlternatingWeekType | "both";

export type ScheduleWeekSettings = Readonly<{
  anchorDate: string;
  anchorWeekType: AlternatingWeekType;
}>;

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const MILLISECONDS_PER_WEEK = 7 * MILLISECONDS_PER_DAY;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

export type ScheduleWeekSettingsValidation =
  | Readonly<{ ok: true; value: ScheduleWeekSettings }>
  | Readonly<{ ok: false; message: string }>;

function dateValue(date: string): number {
  return Date.parse(`${date}T00:00:00.000Z`);
}

export function getWeekStartDate(date: string): string {
  const value = dateValue(date);
  const daysSinceMonday = (new Date(value).getUTCDay() + 6) % 7;
  return new Date(value - daysSinceMonday * MILLISECONDS_PER_DAY)
    .toISOString()
    .slice(0, 10);
}

export function getNumeratorAnchorDate(settings: ScheduleWeekSettings): string {
  if (settings.anchorWeekType === "numerator") return settings.anchorDate;

  // Старе налаштування могло починатися зі знаменника: наступний тиждень
  // дає еквівалентну дату чисельника без зміни календарного чергування.
  return new Date(dateValue(settings.anchorDate) + MILLISECONDS_PER_WEEK)
    .toISOString()
    .slice(0, 10);
}

export function getWeekTypeForDate(
  date: string,
  settings: ScheduleWeekSettings,
): AlternatingWeekType {
  const weeksFromAnchor = Math.floor(
    (dateValue(getWeekStartDate(date)) - dateValue(getWeekStartDate(settings.anchorDate))) /
      MILLISECONDS_PER_WEEK,
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
  numeratorDate: FormDataEntryValue | null;
}): ScheduleWeekSettingsValidation {
  const anchorDate =
    typeof input.numeratorDate === "string" ? input.numeratorDate.trim() : "";
  const parsedDate = dateValue(anchorDate);

  if (
    !DATE_PATTERN.test(anchorDate) ||
    anchorDate.startsWith("0000-") ||
    !Number.isFinite(parsedDate) ||
    new Date(parsedDate).toISOString().slice(0, 10) !== anchorDate
  ) {
    return { ok: false, message: "Вкажіть коректну дату тижня-чисельника." };
  }

  return { ok: true, value: { anchorDate, anchorWeekType: "numerator" } };
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
