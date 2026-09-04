import { describe, expect, it } from "vitest";

import {
  getQStashSchedulerStatus,
  initializeQStashSchedules,
  pushScannerSchedules,
} from "./qstash-schedules";

const scannerUrl = "https://vidmitka.vercel.app/api/internal/push/scan";
const baseEnvironment = {
  QSTASH_URL: "https://qstash-eu-central-1.upstash.io",
  QSTASH_TOKEN: "test-token-not-a-secret",
  PUSH_SCANNER_URL: scannerUrl,
};

function queuedFetcher(responses: Response[]) {
  const calls: Array<Readonly<{ input: string; init: RequestInit | undefined }>> = [];
  const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ input: String(input), init });
    return responses.shift() ?? new Response(null, { status: 500 });
  }) as typeof fetch;

  return { calls, fetcher };
}

describe("QStash push scanner schedules", () => {
  it("does not call QStash when the server-only configuration is incomplete", async () => {
    const { calls, fetcher } = queuedFetcher([]);

    const status = await getQStashSchedulerStatus({
      environment: { PUSH_SCANNER_URL: scannerUrl },
      fetcher,
    });

    expect(calls).toEqual([]);
    expect(status.configured).toBe(false);
    expect(status.reachable).toBe(false);
    expect(status.schedules.every((schedule) => schedule.state === "not-configured")).toBe(true);
  });

  it("does not call an arbitrary Upstash subdomain when QSTASH_URL is invalid", async () => {
    const { calls, fetcher } = queuedFetcher([]);

    const status = await getQStashSchedulerStatus({
      environment: { ...baseEnvironment, QSTASH_URL: "https://any-non-qstash-service.upstash.io" },
      fetcher,
    });

    expect(calls).toEqual([]);
    expect(status.configured).toBe(false);
  });

  it("does not call QStash when PUSH_SCANNER_URL is not the canonical production scanner", async () => {
    const { calls, fetcher } = queuedFetcher([]);

    const status = await getQStashSchedulerStatus({
      environment: { ...baseEnvironment, PUSH_SCANNER_URL: "https://other.example/api/internal/push/scan" },
      fetcher,
    });

    expect(calls).toEqual([]);
    expect(status.configured).toBe(false);
  });

  it("reports the scheduled QStash trigger times for both exact schedules", async () => {
    const lastScheduleTime = Date.UTC(2026, 8, 4, 7, 0);
    const nextScheduleTime = Date.UTC(2026, 8, 4, 7, 1);
    const { fetcher } = queuedFetcher([new Response(JSON.stringify(pushScannerSchedules.map((schedule) => ({
      scheduleId: schedule.id,
      cron: schedule.cron,
      destination: scannerUrl,
      method: "POST",
      body: "{\"version\":1}",
      isPaused: false,
      lastScheduleTime,
      nextScheduleTime,
    }))), { status: 200 })]);

    const status = await getQStashSchedulerStatus({ environment: baseEnvironment, fetcher });

    expect(status).toMatchObject({ configured: true, reachable: true });
    expect(status.schedules.map((schedule) => schedule.state)).toEqual(["ready", "ready"]);
    expect(status.schedules[0]?.lastScheduledAt).toBe(new Date(lastScheduleTime).toISOString());
    expect(status.schedules[1]?.nextScheduledAt).toBe(new Date(nextScheduleTime).toISOString());
  });

  it("creates or overwrites only the two fixed POST schedules", async () => {
    const { calls, fetcher } = queuedFetcher([
      new Response(JSON.stringify({ scheduleId: pushScannerSchedules[0].id }), { status: 200 }),
      new Response(JSON.stringify({ scheduleId: pushScannerSchedules[1].id }), { status: 200 }),
    ]);

    const result = await initializeQStashSchedules({ environment: baseEnvironment, fetcher });

    expect(result.success).toBe(true);
    expect(calls).toHaveLength(2);
    for (const [index, schedule] of pushScannerSchedules.entries()) {
      const call = calls[index];
      const headers = new Headers(call?.init?.headers);
      expect(call?.input).toBe(`https://qstash-eu-central-1.upstash.io/v2/schedules/${encodeURIComponent(scannerUrl)}`);
      expect(call?.init?.method).toBe("POST");
      expect(call?.init?.body).toBe("{\"version\":1}");
      expect(headers.get("upstash-cron")).toBe(schedule.cron);
      expect(headers.get("upstash-schedule-id")).toBe(schedule.id);
      expect(headers.get("upstash-method")).toBe("POST");
      expect(headers.get("content-type")).toBe("application/json");
      expect(headers.get("authorization")).toBe("Bearer test-token-not-a-secret");
    }
  });

  it("returns a safe error when QStash rejects the token", async () => {
    const { fetcher } = queuedFetcher([new Response("denied", { status: 401 })]);

    const result = await initializeQStashSchedules({ environment: baseEnvironment, fetcher });

    expect(result).toEqual({
      success: false,
      message: "QStash відхилив доступ. Перевірте новий QSTASH_TOKEN у Vercel Production.",
    });
    expect(result.message).not.toContain(baseEnvironment.QSTASH_TOKEN);
  });
});
