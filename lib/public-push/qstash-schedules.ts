import "server-only";

const SCANNER_PATH = "/api/internal/push/scan";
const CANONICAL_SCANNER_URL = "https://vidmitka.vercel.app/api/internal/push/scan";
const SCANNER_BODY = JSON.stringify({ version: 1 });
const qstashApiHosts = new Set([
  "qstash.upstash.io",
  "qstash-eu-central-1.upstash.io",
  "qstash-us-east-1.upstash.io",
]);

export const pushScannerSchedules = [
  {
    id: "vidmitka-push-scan-day",
    label: "Щохвилини: 07:00–19:59",
    cron: "CRON_TZ=Europe/Kyiv * 7-19 * * *",
  },
  {
    id: "vidmitka-push-scan-20",
    label: "Окремий запуск о 20:00",
    cron: "CRON_TZ=Europe/Kyiv 0 20 * * *",
  },
] as const;

export type PushScannerScheduleId = (typeof pushScannerSchedules)[number]["id"];
export type QStashScheduleState = "ready" | "missing" | "paused" | "outdated" | "unavailable" | "not-configured";

export type PushScannerScheduleStatus = Readonly<{
  id: PushScannerScheduleId;
  label: string;
  cron: string;
  state: QStashScheduleState;
  lastScheduledAt: string | null;
  nextScheduledAt: string | null;
}>;

export type QStashSchedulerStatus = Readonly<{
  configured: boolean;
  reachable: boolean;
  message: string;
  schedules: readonly PushScannerScheduleStatus[];
}>;

export type QStashScheduleActionResult = Readonly<{
  success: boolean;
  message: string;
}>;

type Environment = Readonly<Record<string, string | undefined>>;
type Fetcher = typeof fetch;

export type QStashScheduleDependencies = Readonly<{
  environment?: Environment;
  fetcher?: Fetcher;
}>;

type QStashConfiguration = Readonly<{
  baseUrl: string;
  token: string;
  destination: string;
}>;

type QStashScheduleMetadata = Readonly<{
  id: string;
  cron: string;
  destination: string;
  method: string;
  body: unknown;
  paused: boolean;
  lastScheduledAt: string | null;
  nextScheduledAt: string | null;
}>;

class QStashRequestError extends Error {
  constructor(readonly status: number | null) {
    super("QStash request failed.");
  }
}

function requiredValue(environment: Environment, name: string): string | null {
  const value = environment[name]?.trim();
  return value ? value : null;
}

function parseQStashUrl(value: string | null): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:"
      || !qstashApiHosts.has(url.hostname)
      || url.username
      || url.password
      || url.pathname !== "/"
      || url.search
      || url.hash
    ) return null;

    return url.origin;
  } catch {
    return null;
  }
}

function parseScannerUrl(value: string | null): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:"
      || url.username
      || url.password
      || url.pathname !== SCANNER_PATH
      || url.search
      || url.hash
      || url.href !== CANONICAL_SCANNER_URL
    ) return null;

    return url.href;
  } catch {
    return null;
  }
}

function getConfiguration(environment: Environment): QStashConfiguration | null {
  const baseUrl = parseQStashUrl(requiredValue(environment, "QSTASH_URL"));
  const token = requiredValue(environment, "QSTASH_TOKEN");
  const destination = parseScannerUrl(requiredValue(environment, "PUSH_SCANNER_URL"));

  return baseUrl && token && destination ? { baseUrl, token, destination } : null;
}

function notConfiguredStatus(): QStashSchedulerStatus {
  return {
    configured: false,
    reachable: false,
    message: "Додайте коректні QSTASH_URL, QSTASH_TOKEN і PUSH_SCANNER_URL у Vercel Production environment variables.",
    schedules: pushScannerSchedules.map((schedule) => ({
      ...schedule,
      state: "not-configured",
      lastScheduledAt: null,
      nextScheduledAt: null,
    })),
  };
}

function responseMessage(status: number | null, action: "read" | "write"): string {
  if (status === 401 || status === 403) {
    return "QStash відхилив доступ. Перевірте новий QSTASH_TOKEN у Vercel Production.";
  }

  return action === "read"
    ? "Не вдалося отримати стан QStash. Спробуйте оновити сторінку пізніше."
    : "Не вдалося оновити всі QStash cron-запуски. Спробуйте ще раз.";
}

function qstashUrl(configuration: QStashConfiguration, path: string): string {
  return new URL(path, configuration.baseUrl).toString();
}

function requestHeaders(configuration: QStashConfiguration): Readonly<Record<string, string>> {
  return { Authorization: `Bearer ${configuration.token}` };
}

function readUnknownRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function readTimestamp(value: unknown): string | null {
  const numericValue = typeof value === "number"
    ? value
    : typeof value === "string" && /^\d+$/u.test(value) ? Number(value) : NaN;
  if (!Number.isFinite(numericValue) || numericValue <= 0) return null;

  const milliseconds = numericValue < 1_000_000_000_000 ? numericValue * 1_000 : numericValue;
  const date = new Date(milliseconds);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function parseMetadata(value: unknown): QStashScheduleMetadata | null {
  const record = readUnknownRecord(value);
  if (!record || typeof record.scheduleId !== "string") return null;

  return {
    id: record.scheduleId,
    cron: typeof record.cron === "string" ? record.cron : "",
    destination: typeof record.destination === "string" ? record.destination : "",
    method: typeof record.method === "string" ? record.method : "",
    body: record.body,
    paused: record.isPaused === true,
    lastScheduledAt: readTimestamp(record.lastScheduleTime),
    nextScheduledAt: readTimestamp(record.nextScheduleTime),
  };
}

function parseSchedules(value: unknown): QStashScheduleMetadata[] {
  const record = readUnknownRecord(value);
  const items = Array.isArray(value) ? value : Array.isArray(record?.schedules) ? record.schedules : [];
  return items.flatMap((item) => {
    const parsed = parseMetadata(item);
    return parsed ? [parsed] : [];
  });
}

function isExpectedBody(value: unknown): boolean {
  let parsed: unknown = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return false;
    }
  }

  const record = readUnknownRecord(parsed);
  if (!record) return false;
  return Object.keys(record).length === 1 && record.version === 1;
}

function hasExpectedConfiguration(metadata: QStashScheduleMetadata, schedule: (typeof pushScannerSchedules)[number], destination: string): boolean {
  return metadata.cron === schedule.cron
    && metadata.destination === destination
    && metadata.method.toUpperCase() === "POST"
    && isExpectedBody(metadata.body);
}

function toStatus(
  schedule: (typeof pushScannerSchedules)[number],
  metadata: QStashScheduleMetadata | undefined,
  destination: string,
): PushScannerScheduleStatus {
  const state: QStashScheduleState = !metadata
    ? "missing"
    : metadata.paused
      ? "paused"
      : hasExpectedConfiguration(metadata, schedule, destination)
        ? "ready"
        : "outdated";

  return {
    ...schedule,
    state,
    lastScheduledAt: metadata?.lastScheduledAt ?? null,
    nextScheduledAt: metadata?.nextScheduledAt ?? null,
  };
}

async function listSchedules(
  configuration: QStashConfiguration,
  fetcher: Fetcher,
): Promise<QStashScheduleMetadata[]> {
  let response: Response;
  try {
    response = await fetcher(qstashUrl(configuration, "/v2/schedules"), {
      method: "GET",
      headers: requestHeaders(configuration),
      cache: "no-store",
    });
  } catch {
    throw new QStashRequestError(null);
  }

  if (!response.ok) throw new QStashRequestError(response.status);

  try {
    return parseSchedules(await response.json());
  } catch {
    throw new QStashRequestError(null);
  }
}

export async function getQStashSchedulerStatus(
  dependencies: QStashScheduleDependencies = {},
): Promise<QStashSchedulerStatus> {
  const environment = dependencies.environment ?? process.env;
  const configuration = getConfiguration(environment);
  if (!configuration) return notConfiguredStatus();

  try {
    const metadata = await listSchedules(configuration, dependencies.fetcher ?? fetch);
    const byId = new Map(metadata.map((item) => [item.id, item]));
    return {
      configured: true,
      reachable: true,
      message: "QStash підключено. Час нижче — останній і наступний заплановані запуски QStash.",
      schedules: pushScannerSchedules.map((schedule) => toStatus(schedule, byId.get(schedule.id), configuration.destination)),
    };
  } catch (error) {
    const status = error instanceof QStashRequestError ? error.status : null;
    return {
      configured: true,
      reachable: false,
      message: responseMessage(status, "read"),
      schedules: pushScannerSchedules.map((schedule) => ({
        ...schedule,
        state: "unavailable",
        lastScheduledAt: null,
        nextScheduledAt: null,
      })),
    };
  }
}

async function createOrUpdateSchedule(
  configuration: QStashConfiguration,
  schedule: (typeof pushScannerSchedules)[number],
  fetcher: Fetcher,
): Promise<void> {
  let response: Response;
  try {
    response = await fetcher(
      qstashUrl(configuration, `/v2/schedules/${encodeURIComponent(configuration.destination)}`),
      {
        method: "POST",
        headers: {
          ...requestHeaders(configuration),
          "Content-Type": "application/json",
          "Upstash-Cron": schedule.cron,
          "Upstash-Schedule-Id": schedule.id,
          "Upstash-Method": "POST",
        },
        body: SCANNER_BODY,
        cache: "no-store",
      },
    );
  } catch {
    throw new QStashRequestError(null);
  }

  if (!response.ok) throw new QStashRequestError(response.status);
}

export async function initializeQStashSchedules(
  dependencies: QStashScheduleDependencies = {},
): Promise<QStashScheduleActionResult> {
  const environment = dependencies.environment ?? process.env;
  const configuration = getConfiguration(environment);
  if (!configuration) {
    return { success: false, message: notConfiguredStatus().message };
  }

  const fetcher = dependencies.fetcher ?? fetch;
  try {
    for (const schedule of pushScannerSchedules) {
      await createOrUpdateSchedule(configuration, schedule, fetcher);
    }
  } catch (error) {
    const status = error instanceof QStashRequestError ? error.status : null;
    return { success: false, message: responseMessage(status, "write") };
  }

  return {
    success: true,
    message: "Два QStash cron-запуски створено або оновлено. Стан таблиці оновлено.",
  };
}
