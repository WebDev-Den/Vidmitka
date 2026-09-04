import type { PublicScheduleItem } from "@/lib/schedule-v2/public-schedule";

export const KYIV_TIME_ZONE = "Europe/Kyiv";
export const PUSH_SCAN_START_MINUTE = 7 * 60;
export const PUSH_SCAN_END_MINUTE = 20 * 60;
export const PUSH_LATE_GRACE_MINUTES = 1;
const PUSH_SCAN_LAST_ACCEPTED_MINUTE = PUSH_SCAN_END_MINUTE + PUSH_LATE_GRACE_MINUTES;
export const PUSH_REMINDER_MINUTES_MIN = 1;
export const PUSH_REMINDER_MINUTES_MAX = 60;
const MAX_DAILY_DIGEST_BODY_LENGTH = 3_500;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/u;
const BASE64_URL_PATTERN = /^[A-Za-z0-9_-]+$/u;
const ACCEPTED_PUSH_PROVIDER_HOST_SUFFIXES = [
  "fcm.googleapis.com",
  "push.services.mozilla.com",
  "web.push.apple.com",
  "notify.windows.com",
] as const;

const kyivDateTimeFormatter = new Intl.DateTimeFormat("en-CA-u-ca-gregory-nu-latn", {
  timeZone: KYIV_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export type PublicPushPreferences = Readonly<{
  teacherId: string;
  morningEnabled: boolean;
  morningTime: string;
  lessonReminderEnabled: boolean;
  lessonLeadMinutes: number;
}>;

export type BrowserPushSubscription = Readonly<{
  endpoint: string;
  expirationTime: number | null;
  keys: Readonly<{
    p256dh: string;
    auth: string;
  }>;
}>;

export type PushValidation<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; message: string }>;

export type KyivDateTimeParts = Readonly<{
  date: string;
  time: string;
  hour: number;
  minute: number;
  minuteOfDay: number;
}>;

export type PublicPushPayload = Readonly<{
  title: string;
  body: string;
  tag: string;
  url: string;
}>;

export type PublicPushDeliveryKeyInput = Readonly<{
  subscriptionId: string;
  notificationKind: "morning" | "lesson";
  date: string;
  scheduledMinute: number;
  scheduleItemId?: string;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" ? value.trim() : null;
}

function booleanValue(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function numericValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function localMinute(value: string): number | null {
  if (!TIME_PATTERN.test(value)) return null;
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function isSupportedPushProvider(hostname: string): boolean {
  return ACCEPTED_PUSH_PROVIDER_HOST_SUFFIXES.some(
    (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`),
  );
}

function isBase64Url(value: string, maximumLength: number): boolean {
  return value.length >= 16 && value.length <= maximumLength && BASE64_URL_PATTERN.test(value);
}

function formatPartNumber(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): number {
  const raw = parts.find((part) => part.type === type)?.value;
  const parsed = raw ? Number(raw) : Number.NaN;
  if (!Number.isInteger(parsed)) throw new RangeError("Не вдалося визначити час у часовому поясі Києва.");
  return parsed;
}

function formatLessonLocation(item: PublicScheduleItem): string {
  return item.rooms.length > 0 ? `Аудиторія: ${item.rooms.join(", ")}` : "Аудиторію не вказано";
}

function formatLessonGroups(item: PublicScheduleItem): string {
  return item.groups.length > 0 ? `Групи: ${item.groups.join(", ")}` : "Групи не вказано";
}

function activeItems(items: readonly PublicScheduleItem[]): PublicScheduleItem[] {
  return items
    .filter((item) => !item.cancelled)
    .slice()
    .sort((left, right) => left.startTime.localeCompare(right.startTime) || left.periodNumber - right.periodNumber);
}

/** Перевіряє UUID, який використовується як публічний ідентифікатор викладача. */
export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

/** Перетворює годинник `HH:MM` на хвилину доби або повертає `null`. */
export function parseTimeToMinute(value: string): number | null {
  return localMinute(value);
}

/**
 * Нормалізує безпечні налаштування одного браузерного пристрою. Значення не
 * пов'язані з обліковим записом: `teacherId` — це лише вибраний публічний розклад.
 */
export function validatePublicPushPreferences(input: unknown): PushValidation<PublicPushPreferences> {
  if (!isRecord(input)) return { ok: false, message: "Перевірте налаштування сповіщень." };

  const teacherId = stringValue(input.teacherId);
  if (!teacherId || !isUuid(teacherId)) return { ok: false, message: "Оберіть коректного викладача." };

  const morningEnabled = booleanValue(input.morningEnabled);
  const lessonReminderEnabled = booleanValue(input.lessonReminderEnabled);
  if (morningEnabled === null || lessonReminderEnabled === null) {
    return { ok: false, message: "Перевірте типи сповіщень." };
  }
  if (!morningEnabled && !lessonReminderEnabled) {
    return { ok: false, message: "Оберіть хоча б один тип сповіщень." };
  }

  const morningTime = stringValue(input.morningTime);
  const morningMinute = morningTime ? localMinute(morningTime) : null;
  if (
    morningTime === null ||
    morningMinute === null ||
    morningMinute < PUSH_SCAN_START_MINUTE ||
    morningMinute > PUSH_SCAN_END_MINUTE
  ) {
    return { ok: false, message: "Час ранкового сповіщення має бути від 07:00 до 20:00." };
  }

  const lessonLeadMinutes = numericValue(input.lessonLeadMinutes);
  if (
    lessonLeadMinutes === null ||
    !Number.isInteger(lessonLeadMinutes) ||
    lessonLeadMinutes < PUSH_REMINDER_MINUTES_MIN ||
    lessonLeadMinutes > PUSH_REMINDER_MINUTES_MAX
  ) {
    return { ok: false, message: "Нагадування має бути від 1 до 60 хвилин до заняття." };
  }

  return {
    ok: true,
    value: { teacherId, morningEnabled, morningTime, lessonReminderEnabled, lessonLeadMinutes },
  };
}

/**
 * Перевіряє JSON, отриманий від `PushSubscription.toJSON()`. Повідомлення про
 * помилки не містять endpoint або криптографічних ключів пристрою.
 */
export function validateBrowserPushSubscription(input: unknown): PushValidation<BrowserPushSubscription> {
  if (!isRecord(input)) return { ok: false, message: "Браузер повернув некоректну Push-підписку." };

  const endpoint = stringValue(input.endpoint);
  if (!endpoint || endpoint.length > 4096) {
    return { ok: false, message: "Браузер повернув некоректну Push-підписку." };
  }

  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return { ok: false, message: "Браузер повернув некоректну Push-підписку." };
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) {
    return { ok: false, message: "Push-підписка має використовувати HTTPS." };
  }
  if (!isSupportedPushProvider(url.hostname.toLowerCase())) {
    return { ok: false, message: "Підписка має належати підтримуваному Push-провайдеру." };
  }

  const expirationTime = input.expirationTime === undefined ? null : input.expirationTime;
  if (expirationTime !== null && (typeof expirationTime !== "number" || !Number.isFinite(expirationTime) || expirationTime < 0)) {
    return { ok: false, message: "Браузер повернув некоректний строк дії Push-підписки." };
  }

  if (!isRecord(input.keys)) return { ok: false, message: "Браузер не надав ключі Push-підписки." };
  const p256dh = stringValue(input.keys.p256dh);
  const auth = stringValue(input.keys.auth);
  if (!p256dh || !auth || !isBase64Url(p256dh, 512) || !isBase64Url(auth, 256)) {
    return { ok: false, message: "Браузер не надав коректні ключі Push-підписки." };
  }

  return { ok: true, value: { endpoint, expirationTime, keys: { p256dh, auth } } };
}

/** Повертає локальні дату, час і хвилину доби в часовому поясі Europe/Kyiv. */
export function getKyivDateTimeParts(value: Date = new Date()): KyivDateTimeParts {
  const parts = kyivDateTimeFormatter.formatToParts(value);
  const year = formatPartNumber(parts, "year");
  const month = formatPartNumber(parts, "month");
  const day = formatPartNumber(parts, "day");
  const hour = formatPartNumber(parts, "hour");
  const minute = formatPartNumber(parts, "minute");

  return {
    date: `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`,
    time: `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`,
    hour,
    minute,
    minuteOfDay: hour * 60 + minute,
  };
}

/**
 * Чи належить хвилина Києва до вікна scanner-а. Планувальник запускається лише
 * до 20:00 включно; ще одна хвилина приймається виключно для обробки затриманої
 * доставки події рівно о 20:00.
 */
export function isWithinPushScanWindow(value: number | Date | Pick<KyivDateTimeParts, "minuteOfDay"> = new Date()): boolean {
  const minuteOfDay = typeof value === "number"
    ? value
    : value instanceof Date
      ? getKyivDateTimeParts(value).minuteOfDay
      : value.minuteOfDay;
  return Number.isInteger(minuteOfDay)
    && minuteOfDay >= PUSH_SCAN_START_MINUTE
    && minuteOfDay <= PUSH_SCAN_LAST_ACCEPTED_MINUTE;
}

/**
 * Подія настає в заплановану хвилину або не більше ніж через хвилину після неї.
 * Негативна різниця навмисно не допускається: повідомлення ніколи не йде раніше.
 */
export function isDueAtKyivMinute(
  scheduledMinute: number,
  currentMinute: number,
  lateGraceMinutes = PUSH_LATE_GRACE_MINUTES,
): boolean {
  if (
    !Number.isInteger(scheduledMinute) ||
    !Number.isInteger(currentMinute) ||
    !Number.isInteger(lateGraceMinutes) ||
    scheduledMinute < 0 ||
    scheduledMinute >= 24 * 60 ||
    currentMinute < 0 ||
    currentMinute >= 24 * 60 ||
    lateGraceMinutes < 0
  ) return false;

  const elapsedMinutes = currentMinute - scheduledMinute;
  return elapsedMinutes >= 0 && elapsedMinutes <= lateGraceMinutes;
}

/** Чи надійшов час щоденного зведення для цих налаштувань. */
export function isMorningDigestDue(
  preferences: PublicPushPreferences,
  now: Pick<KyivDateTimeParts, "minuteOfDay">,
): boolean {
  const scheduledMinute = localMinute(preferences.morningTime);
  return preferences.morningEnabled && scheduledMinute !== null && isDueAtKyivMinute(scheduledMinute, now.minuteOfDay);
}

/** Чи надійшов час нагадування про конкретне активне заняття. */
export function isLessonReminderDue(
  item: PublicScheduleItem,
  preferences: PublicPushPreferences,
  now: Pick<KyivDateTimeParts, "date" | "minuteOfDay">,
): boolean {
  if (!preferences.lessonReminderEnabled || item.cancelled || item.occurrenceDate !== now.date) return false;
  const startMinute = localMinute(item.startTime);
  if (startMinute === null || !Number.isInteger(preferences.lessonLeadMinutes)) return false;
  const scheduledMinute = startMinute - preferences.lessonLeadMinutes;
  return scheduledMinute >= 0 && isDueAtKyivMinute(scheduledMinute, now.minuteOfDay);
}

/** Створює зміст щоденного повідомлення лише з активних занять. */
export function createDailyDigestPayload(date: string, items: readonly PublicScheduleItem[]): PublicPushPayload {
  const lessons = activeItems(items);
  if (lessons.length === 0) {
    return {
      title: "Розклад на сьогодні",
      body: "Сьогодні занять немає 🙂",
      tag: `vidmitka:morning:${date}`,
      url: "/",
    };
  }

  const lines = lessons.map((item) => [
    `${item.periodNumber} пара · ${item.startTime}–${item.endTime}`,
    item.discipline,
    formatLessonLocation(item),
    formatLessonGroups(item),
  ].join("\n"));
  const bodyParts: string[] = [];
  for (const [index, line] of lines.entries()) {
    const candidate = [...bodyParts, line].join("\n\n");
    if (candidate.length > MAX_DAILY_DIGEST_BODY_LENGTH) {
      bodyParts.push(`Ще занять: ${lines.length - index}.`);
      break;
    }
    bodyParts.push(line);
  }

  return {
    title: "Розклад на сьогодні",
    body: bodyParts.join("\n\n"),
    tag: `vidmitka:morning:${date}`,
    url: "/",
  };
}

/** Створює нагадування з номером, часом, аудиторією та групами конкретного заняття. */
export function createClassReminderPayload(item: PublicScheduleItem): PublicPushPayload {
  return {
    title: `Нагадування: ${item.periodNumber} пара`,
    body: [
      `${item.periodNumber} пара · ${item.startTime}–${item.endTime}`,
      item.discipline,
      formatLessonLocation(item),
      formatLessonGroups(item),
    ].join("\n"),
    tag: `vidmitka:lesson:${item.occurrenceDate}:${item.id}`,
    url: "/",
  };
}

/** Створює нейтральне повідомлення для перевірки вже збереженої browser-підписки. */
export function createTestPushPayload(): PublicPushPayload {
  return {
    title: "Тестове сповіщення",
    body: "Якщо ви бачите це повідомлення, push-сповіщення працюють.",
    tag: "vidmitka:test",
    url: "/",
  };
}

/**
 * Повертає стабільний SHA-256 ключ ідемпотентної доставки без endpoint чи ключів
 * браузера. Працює і в браузері, і в сучасному Node через стандартний Web Crypto.
 */
export async function createPushDeliveryKey(input: PublicPushDeliveryKeyInput): Promise<string> {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.subtle) throw new Error("Web Crypto API недоступний для формування ключа доставки.");

  const canonical = [
    "v1",
    `subscription:${input.subscriptionId}`,
    `kind:${input.notificationKind}`,
    `date:${input.date}`,
    `minute:${input.scheduledMinute}`,
    `item:${input.scheduleItemId ?? ""}`,
  ].join("\n");
  const hash = await cryptoApi.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  const value = Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return value;
}
