import { describe, expect, it } from "vitest";

import { runPublicPushScanner, type PublicPushScannerDependencies } from "./scanner";
import type { ActivePublicPushSubscription, DeliveryClaim } from "./repository";
import type { PushSendResult } from "./sender";
import type { PublicScheduleDay, PublicScheduleItem } from "@/lib/schedule-v2/public-schedule";

const teacherId = "7f67b6d8-1979-4f28-80ea-cedda7d4d0f6";
const subscriptionId = "7f67b6d8-1979-4f28-80ea-cedda7d4d0f8";

function scheduleItem(overrides: Partial<PublicScheduleItem> = {}): PublicScheduleItem {
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

function scheduleDay(date: string, items: readonly PublicScheduleItem[]): PublicScheduleDay {
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

function subscription(overrides: Partial<ActivePublicPushSubscription> = {}): ActivePublicPushSubscription {
  return {
    id: subscriptionId,
    configVersion: 1,
    teacherId,
    teacherName: "Тестовий Викладач",
    morningTime: null,
    lessonLeadMinutes: null,
    endpoint: {
      endpoint: "https://fcm.googleapis.com/fcm/send/test-device",
      expirationTime: null,
      p256dh: "cHVibGljLWtleS1ieXRlcw",
      auth: "YXV0aC1zZWNyZXQ",
    },
    ...overrides,
  };
}

type ScannerCallLog = {
  list: number;
  read: Array<{ date: string; teacherId: string }>;
  claim: Array<Parameters<PublicPushScannerDependencies["claim"]>[0]>;
  finalize: Array<Parameters<PublicPushScannerDependencies["finalize"]>[0]>;
  revoke: Array<Parameters<PublicPushScannerDependencies["revoke"]>>;
  send: Array<{
    endpoint: ActivePublicPushSubscription["endpoint"];
    payload: Parameters<PublicPushScannerDependencies["send"]>[1];
  }>;
};

function createDependencies(input: {
  subscriptions: readonly ActivePublicPushSubscription[];
  day: PublicScheduleDay;
  claimResult?: DeliveryClaim | null;
  sendResults?: readonly PushSendResult[];
}): { dependencies: PublicPushScannerDependencies; calls: ScannerCallLog } {
  const calls: ScannerCallLog = { list: 0, read: [], claim: [], finalize: [], revoke: [], send: [] };
  const claimResult = input.claimResult === undefined
    ? { id: "7f67b6d8-1979-4f28-80ea-cedda7d4d0f9", leaseToken: "7f67b6d8-1979-4f28-80ea-cedda7d4d0fa" }
    : input.claimResult;
  const sendResults: PushSendResult[] = [...(input.sendResults ?? [{ kind: "sent", statusCode: 201 }])];

  return {
    calls,
    dependencies: {
      listSubscriptions: async () => {
        calls.list += 1;
        return input.subscriptions;
      },
      readSchedule: async (request) => {
        calls.read.push(request);
        return input.day;
      },
      claim: async (request) => {
        calls.claim.push(request);
        return claimResult;
      },
      finalize: async (request) => {
        calls.finalize.push(request);
      },
      revoke: async (...request) => {
        calls.revoke.push(request);
      },
      send: async (endpoint, payload) => {
        calls.send.push({ endpoint, payload });
        return sendResults.shift() ?? { kind: "sent", statusCode: 201 };
      },
    },
  };
}

describe("runPublicPushScanner", () => {
  it("надсилає щоденне зведення Києвом з точним текстом про відсутність занять", async () => {
    const now = new Date("2026-09-04T04:30:00.000Z"); // 07:30 Europe/Kyiv
    const fixture = createDependencies({
      subscriptions: [subscription({ morningTime: "07:30" })],
      day: scheduleDay("2026-09-04", []),
    });

    await expect(runPublicPushScanner(now, fixture.dependencies)).resolves.toMatchObject({
      scanned: true,
      subscriptions: 1,
      claimed: 1,
      sent: 1,
    });
    expect(fixture.calls.read).toEqual([{ date: "2026-09-04", teacherId }]);
    expect(fixture.calls.send).toHaveLength(1);
    expect(fixture.calls.send[0]?.payload).toMatchObject({
      title: "Розклад на сьогодні",
      body: "Сьогодні занять немає 🙂",
    });
    expect(fixture.calls.claim[0]).toMatchObject({ kind: "daily_digest", subscriptionId });
  });

  it("за хвилину запізнення надсилає тільки належне нагадування про пару", async () => {
    const now = new Date("2026-09-04T04:46:00.000Z"); // 07:46 Europe/Kyiv
    const fixture = createDependencies({
      subscriptions: [subscription({ lessonLeadMinutes: 15 })],
      day: scheduleDay("2026-09-04", [
        scheduleItem({ id: "7f67b6d8-1979-4f28-80ea-cedda7d4d0f7", startTime: "08:00" }),
        scheduleItem({ id: "7f67b6d8-1979-4f28-80ea-cedda7d4d0fb", startTime: "08:02", periodNumber: 2 }),
        scheduleItem({ id: "7f67b6d8-1979-4f28-80ea-cedda7d4d0fc", startTime: "07:59", periodNumber: 3 }),
        scheduleItem({ id: "7f67b6d8-1979-4f28-80ea-cedda7d4d0fd", startTime: "08:00", periodNumber: 4, cancelled: true }),
      ]),
    });

    await expect(runPublicPushScanner(now, fixture.dependencies)).resolves.toMatchObject({
      claimed: 1,
      sent: 1,
      skipped: 0,
    });
    expect(fixture.calls.send).toHaveLength(1);
    expect(fixture.calls.send[0]?.payload).toMatchObject({
      title: "Нагадування: 1 пара",
      body: expect.stringContaining("08:00–09:20"),
    });
    expect(fixture.calls.claim[0]).toMatchObject({ kind: "class_reminder", subscriptionId });
  });

  it("не надсилає повідомлення, якщо таку доставку вже захопив інший запуск", async () => {
    const now = new Date("2026-09-04T04:30:00.000Z");
    const fixture = createDependencies({
      subscriptions: [subscription({ morningTime: "07:30" })],
      day: scheduleDay("2026-09-04", []),
      claimResult: null,
    });

    await expect(runPublicPushScanner(now, fixture.dependencies)).resolves.toMatchObject({
      claimed: 0,
      sent: 0,
      skipped: 1,
    });
    expect(fixture.calls.claim).toHaveLength(1);
    expect(fixture.calls.send).toHaveLength(0);
    expect(fixture.calls.finalize).toHaveLength(0);
  });

  it("повторює transient-помилку провайдера один раз у межах тієї самої доставки", async () => {
    const now = new Date("2026-09-04T04:30:00.000Z");
    const fixture = createDependencies({
      subscriptions: [subscription({ morningTime: "07:30" })],
      day: scheduleDay("2026-09-04", []),
      sendResults: [{ kind: "failed", statusCode: 503 }, { kind: "sent", statusCode: 201 }],
    });

    await expect(runPublicPushScanner(now, fixture.dependencies)).resolves.toMatchObject({
      claimed: 1,
      sent: 1,
      failed: 0,
    });
    expect(fixture.calls.send).toHaveLength(2);
    expect(fixture.calls.finalize).toMatchObject([{ outcome: "sent", providerStatus: 201 }]);
  });

  it("поза вікном 07:00–20:00 не викликає жодної залежності", async () => {
    const now = new Date("2026-09-04T03:59:00.000Z"); // 06:59 Europe/Kyiv
    const fixture = createDependencies({
      subscriptions: [subscription({ morningTime: "07:30" })],
      day: scheduleDay("2026-09-04", []),
    });

    await expect(runPublicPushScanner(now, fixture.dependencies)).resolves.toEqual({
      scanned: false,
      subscriptions: 0,
      claimed: 0,
      sent: 0,
      invalid: 0,
      failed: 0,
      skipped: 0,
      scheduleErrors: 0,
    });
    expect(fixture.calls).toEqual({ list: 0, read: [], claim: [], finalize: [], revoke: [], send: [] });
  });
});
