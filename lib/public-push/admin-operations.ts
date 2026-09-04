import "server-only";

import { randomUUID } from "node:crypto";

import { getPublicScheduleDay, type PublicScheduleDay } from "@/lib/schedule-v2/public-schedule";

import type { AdminPushDashboard } from "./admin-types";
import {
  findActivePublicPushSubscriptionById,
  isAdminPublicPushOperationsReady,
  listAdminPublicPushSubscriptions,
  listRecentPublicPushManualDeliveries,
  listRecentPublicPushScanRuns,
  finalizePublicPushManualDelivery,
  revokePushSubscriptionById,
  startPublicPushManualDelivery,
  type ActivePublicPushSubscription,
  type DeliveryKind,
  type ManualDeliveryOutcome,
} from "./repository";
import {
  createClassReminderPayload,
  createDailyDigestPayload,
  getKyivDateTimeParts,
  parseTimeToMinute,
  type PublicPushPayload,
} from "./rules";
import { sendWebPushWithRetry } from "./send-attempt";
import { isWebPushConfigured, sendWebPush, type PushSendResult } from "./sender";

type ScheduleRead = Awaited<ReturnType<typeof getPublicScheduleDay>>;

export type AdminPushActionResult =
  | Readonly<{
    success: true;
    kind: DeliveryKind;
    scheduledDate: string;
    scheduledTime: string;
    message: string;
  }>
  | Readonly<{
    success: false;
    code: "subscription_missing" | "no_upcoming_notification" | "manual_log_unavailable" | "subscription_gone" | "delivery_failed";
    message: string;
  }>;

export type AdminPushOperationsDependencies = Readonly<{
  findSubscription: (subscriptionId: string) => Promise<ActivePublicPushSubscription | null>;
  readSchedule: (input: { date: string; teacherId: string }) => Promise<ScheduleRead>;
  startManualDelivery: (input: {
    subscriptionId: string;
    kind: DeliveryKind;
    scheduledDate: string;
    scheduledTime: string;
  }) => Promise<string | null>;
  finalizeManualDelivery: (input: {
    deliveryId: string;
    outcome: ManualDeliveryOutcome;
    providerStatus: number | null;
  }) => Promise<void>;
  revoke: (subscriptionId: string, reason: "provider_gone") => Promise<void>;
  send: (
    endpoint: ActivePublicPushSubscription["endpoint"],
    payload: PublicPushPayload,
  ) => Promise<PushSendResult>;
}>;

const defaultDependencies: AdminPushOperationsDependencies = {
  findSubscription: findActivePublicPushSubscriptionById,
  readSchedule: getPublicScheduleDay,
  startManualDelivery: startPublicPushManualDelivery,
  finalizeManualDelivery: finalizePublicPushManualDelivery,
  revoke: revokePushSubscriptionById,
  send: sendWebPush,
};

type ScheduledManualPush = Readonly<{
  kind: DeliveryKind;
  date: string;
  time: string;
  minuteOfDay: number;
  payload: PublicPushPayload;
}>;

function nextDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + 1));
  return value.toISOString().slice(0, 10);
}

function preferences(subscription: ActivePublicPushSubscription) {
  return {
    morningTime: subscription.morningTime,
    lessonLeadMinutes: subscription.lessonLeadMinutes,
  };
}

function addScheduleCandidates(input: {
  subscription: ActivePublicPushSubscription;
  day: PublicScheduleDay;
}): ScheduledManualPush[] {
  const values: ScheduledManualPush[] = [];
  const setting = preferences(input.subscription);
  const morningMinute = setting.morningTime ? parseTimeToMinute(setting.morningTime) : null;
  if (morningMinute !== null && setting.morningTime) {
    values.push({
      kind: "daily_digest",
      date: input.day.date,
      time: setting.morningTime,
      minuteOfDay: morningMinute,
      payload: createDailyDigestPayload(input.day.date, input.day.items),
    });
  }

  if (setting.lessonLeadMinutes !== null) {
    for (const item of input.day.items) {
      if (item.cancelled || item.occurrenceDate !== input.day.date) continue;
      const startMinute = parseTimeToMinute(item.startTime);
      if (startMinute === null) continue;
      const reminderMinute = startMinute - setting.lessonLeadMinutes;
      if (reminderMinute < 0) continue;
      values.push({
        kind: "class_reminder",
        date: item.occurrenceDate,
        time: `${Math.floor(reminderMinute / 60).toString().padStart(2, "0")}:${(reminderMinute % 60).toString().padStart(2, "0")}`,
        minuteOfDay: reminderMinute,
        payload: createClassReminderPayload(item),
      });
    }
  }

  return values;
}

async function findNextScheduledPush(
  subscription: ActivePublicPushSubscription,
  now: Date,
  readSchedule: AdminPushOperationsDependencies["readSchedule"],
): Promise<ScheduledManualPush | null> {
  const clock = getKyivDateTimeParts(now);
  let date = clock.date;

  for (let offset = 0; offset < 7; offset += 1) {
    const day = await readSchedule({ date, teacherId: subscription.teacherId });
    const minimumMinute = offset === 0 ? clock.minuteOfDay : 0;
    const candidate = addScheduleCandidates({ subscription, day })
      .filter((item) => item.minuteOfDay >= minimumMinute)
      .sort((left, right) => left.minuteOfDay - right.minuteOfDay || left.kind.localeCompare(right.kind))[0];
    if (candidate) return candidate;
    date = nextDate(date);
  }

  return null;
}

function manualPayload(candidate: ScheduledManualPush): PublicPushPayload {
  return { ...candidate.payload, tag: `vidmitka:manual:${randomUUID()}` };
}

/** Returns only safe operational data; endpoint and browser keys never cross this interface. */
export async function getAdminPushDashboard(): Promise<AdminPushDashboard> {
  const ready = await isAdminPublicPushOperationsReady();
  if (!ready) {
    return {
      ready: false,
      webPushConfigured: isWebPushConfigured(),
      subscriptions: [],
      scanRuns: [],
      manualDeliveries: [],
    };
  }

  const [subscriptions, scanRuns, manualDeliveries] = await Promise.all([
    listAdminPublicPushSubscriptions(),
    listRecentPublicPushScanRuns(),
    listRecentPublicPushManualDeliveries(),
  ]);
  return { ready: true, webPushConfigured: isWebPushConfigured(), subscriptions, scanRuns, manualDeliveries };
}

/**
 * Replays the nearest future scheduled notification for precisely one active
 * subscription. It has a separate tag and ledger, so it cannot consume the
 * scanner's idempotency key or replace the later scheduled notification.
 */
export async function sendNextScheduledPush(
  subscriptionId: string,
  now: Date = new Date(),
  dependencies: AdminPushOperationsDependencies = defaultDependencies,
): Promise<AdminPushActionResult> {
  const subscription = await dependencies.findSubscription(subscriptionId);
  if (!subscription) {
    return { success: false, code: "subscription_missing", message: "Активну підписку не знайдено." };
  }

  const candidate = await findNextScheduledPush(subscription, now, dependencies.readSchedule);
  if (!candidate) {
    return {
      success: false,
      code: "no_upcoming_notification",
      message: "Для цієї підписки немає найближчого повідомлення.",
    };
  }

  const deliveryId = await dependencies.startManualDelivery({
    subscriptionId: subscription.id,
    kind: candidate.kind,
    scheduledDate: candidate.date,
    scheduledTime: candidate.time,
  });
  if (!deliveryId) {
    return {
      success: false,
      code: "manual_log_unavailable",
      message: "Не вдалося створити запис ручного запуску.",
    };
  }

  let result: PushSendResult;
  try {
    result = await sendWebPushWithRetry(subscription.endpoint, manualPayload(candidate), dependencies.send);
  } catch {
    result = { kind: "failed", statusCode: null };
  }

  if (result.kind === "sent") {
    await dependencies.finalizeManualDelivery({ deliveryId, outcome: "sent", providerStatus: result.statusCode });
    const eventLabel = candidate.kind === "daily_digest" ? "щоденний розклад" : "нагадування перед заняттям";
    return {
      success: true,
      kind: candidate.kind,
      scheduledDate: candidate.date,
      scheduledTime: candidate.time,
      message: `Надіслано: ${eventLabel} на ${candidate.date} о ${candidate.time}.`,
    };
  }

  if (result.kind === "gone") {
    await dependencies.finalizeManualDelivery({ deliveryId, outcome: "invalid", providerStatus: result.statusCode });
    await dependencies.revoke(subscription.id, "provider_gone");
    return {
      success: false,
      code: "subscription_gone",
      message: "Пристрій більше не приймає сповіщення; підписку вимкнено.",
    };
  }

  await dependencies.finalizeManualDelivery({ deliveryId, outcome: "failed", providerStatus: result.statusCode });
  return { success: false, code: "delivery_failed", message: "Не вдалося доставити повідомлення. Спробуйте пізніше." };
}
