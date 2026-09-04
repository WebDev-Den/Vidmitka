import { describe, expect, it } from "vitest";

import { sendNextScheduledPush, type AdminPushOperationsDependencies } from "./admin-operations";
import type { ActivePublicPushSubscription } from "./repository";
import type { PushSendResult } from "./sender";
import type { PublicScheduleDay, PublicScheduleItem } from "@/lib/schedule-v2/public-schedule";

const teacherId = "7f67b6d8-1979-4f28-80ea-cedda7d4d0f6";
const subscriptionId = "7f67b6d8-1979-4f28-80ea-cedda7d4d0f8";
const deliveryId = "7f67b6d8-1979-4f28-80ea-cedda7d4d0f9";

function subscription(overrides: Partial<ActivePublicPushSubscription> = {}): ActivePublicPushSubscription {
  return {
    id: subscriptionId,
    configVersion: 1,
    teacherId,
    teacherName: "Тестовий Викладач",
    morningTime: "08:00",
    lessonLeadMinutes: 15,
    endpoint: {
      endpoint: "https://fcm.googleapis.com/fcm/send/test-device",
      expirationTime: null,
      p256dh: "cHVibGljLWtleS1ieXRlcw",
      auth: "YXV0aC1zZWNyZXQ",
    },
    ...overrides,
  };
}

function day(date: string, items: readonly PublicScheduleItem[] = []): PublicScheduleDay {
  return {
    date,
    calendarDayOfWeek: 5,
    scheduleDayOfWeek: 5,
    weekType: "numerator",
    weekConfigured: true,
    isTransfer: false,
    items,
  };
}

function item(overrides: Partial<PublicScheduleItem> = {}): PublicScheduleItem {
  return {
    id: "7f67b6d8-1979-4f28-80ea-cedda7d4d0f7",
    occurrenceDate: "2026-09-04",
    periodNumber: 1,
    startTime: "08:00",
    endTime: "09:20",
    discipline: "Аналіз даних",
    lessonType: "Лекція",
    lessonTypeColor: "#0F766E",
    groups: ["QA-1"],
    teachers: ["Тестовий Викладач"],
    rooms: ["1-101"],
    note: "",
    changeKind: null,
    changeReason: "",
    cancelled: false,
    originalDate: null,
    ...overrides,
  };
}

function createDependencies(input: {
  current?: ActivePublicPushSubscription | null;
  days?: Record<string, PublicScheduleDay>;
  sendResult?: PushSendResult;
  sendResults?: readonly PushSendResult[];
}) {
  const calls = {
    reads: [] as Array<{ date: string; teacherId: string }>,
    sent: [] as Array<{ payload: { title: string; body: string; tag: string } }>,
    started: [] as Array<{ kind: "daily_digest" | "class_reminder"; scheduledDate: string; scheduledTime: string }>,
    finalized: [] as Array<{ outcome: "sent" | "failed" | "invalid"; providerStatus: number | null }>,
    revoked: [] as string[],
  };
  const sendResults = [...(input.sendResults ?? [input.sendResult ?? { kind: "sent", statusCode: 201 }])];
  const dependencies: AdminPushOperationsDependencies = {
    findSubscription: async () => input.current === undefined ? subscription() : input.current,
    readSchedule: async (request) => {
      calls.reads.push(request);
      return input.days?.[request.date] ?? day(request.date);
    },
    startManualDelivery: async (request) => {
      calls.started.push(request);
      return deliveryId;
    },
    finalizeManualDelivery: async (request) => {
      calls.finalized.push(request);
    },
    revoke: async (id) => {
      calls.revoked.push(id);
    },
    send: async (_endpoint, payload) => {
      calls.sent.push({ payload });
      return sendResults.shift() ?? { kind: "sent", statusCode: 201 };
    },
  };
  return { dependencies, calls };
}

describe("sendNextScheduledPush", () => {
  it("надсилає найближчий щоденний розклад з окремим manual tag", async () => {
    const fixture = createDependencies({
      current: subscription({ lessonLeadMinutes: null }),
      days: { "2026-09-04": day("2026-09-04", [item()]) },
    });

    await expect(sendNextScheduledPush(subscriptionId, new Date("2026-09-04T04:30:00.000Z"), fixture.dependencies))
      .resolves.toMatchObject({ success: true, kind: "daily_digest", scheduledDate: "2026-09-04", scheduledTime: "08:00" });

    expect(fixture.calls.reads).toEqual([{ date: "2026-09-04", teacherId }]);
    expect(fixture.calls.started).toEqual([{ subscriptionId, kind: "daily_digest", scheduledDate: "2026-09-04", scheduledTime: "08:00" }]);
    expect(fixture.calls.sent[0]?.payload).toMatchObject({
      title: "Розклад на сьогодні",
      body: expect.stringContaining("1 пара · 08:00–09:20"),
      tag: expect.stringMatching(/^vidmitka:manual:/u),
    });
    expect(fixture.calls.finalized).toEqual([{ deliveryId, outcome: "sent", providerStatus: 201 }]);
  });

  it("обирає майбутнє нагадування раніше за завтрашній digest", async () => {
    const fixture = createDependencies({
      current: subscription({ morningTime: "07:00", lessonLeadMinutes: 15 }),
      days: {
        "2026-09-04": day("2026-09-04", [item({ startTime: "09:00", endTime: "10:20" })]),
      },
    });

    await expect(sendNextScheduledPush(subscriptionId, new Date("2026-09-04T04:30:00.000Z"), fixture.dependencies))
      .resolves.toMatchObject({ success: true, kind: "class_reminder", scheduledTime: "08:45" });
  });

  it("не створює log або delivery, коли для reminder-only підписки немає заняття", async () => {
    const fixture = createDependencies({ current: subscription({ morningTime: null, lessonLeadMinutes: 15 }) });

    await expect(sendNextScheduledPush(subscriptionId, new Date("2026-09-04T18:00:00.000Z"), fixture.dependencies))
      .resolves.toEqual({ success: false, code: "no_upcoming_notification", message: "Для цієї підписки немає найближчого повідомлення." });

    expect(fixture.calls.started).toHaveLength(0);
    expect(fixture.calls.sent).toHaveLength(0);
    expect(fixture.calls.finalized).toHaveLength(0);
  });

  it("позначає manual delivery недійсною та відкликає застарілу підписку", async () => {
    const fixture = createDependencies({ sendResult: { kind: "gone", statusCode: 410 } });

    await expect(sendNextScheduledPush(subscriptionId, new Date("2026-09-04T04:30:00.000Z"), fixture.dependencies))
      .resolves.toMatchObject({ success: false, code: "subscription_gone" });

    expect(fixture.calls.finalized).toEqual([{ deliveryId, outcome: "invalid", providerStatus: 410 }]);
    expect(fixture.calls.revoked).toEqual([subscriptionId]);
  });

  it("один раз повторює transient-помилку, не створюючи другого manual log", async () => {
    const fixture = createDependencies({
      sendResults: [{ kind: "failed", statusCode: 503 }, { kind: "sent", statusCode: 201 }],
    });

    await expect(sendNextScheduledPush(subscriptionId, new Date("2026-09-04T04:30:00.000Z"), fixture.dependencies))
      .resolves.toMatchObject({ success: true, kind: "daily_digest" });

    expect(fixture.calls.started).toHaveLength(1);
    expect(fixture.calls.sent).toHaveLength(2);
    expect(fixture.calls.finalized).toEqual([{ deliveryId, outcome: "sent", providerStatus: 201 }]);
  });
});
