import "server-only";

import { getPublicScheduleDay } from "@/lib/schedule-v2/public-schedule";

import {
  createClassReminderPayload,
  createDailyDigestPayload,
  createPushDeliveryKey,
  getKyivDateTimeParts,
  isLessonReminderDue,
  isMorningDigestDue,
  isWithinPushScanWindow,
  parseTimeToMinute,
  type PublicPushPayload,
  type PublicPushPreferences,
} from "./rules";
import {
  claimPublicPushDelivery,
  finalizePublicPushDelivery,
  listActivePublicPushSubscriptions,
  revokePushSubscriptionById,
  type ActivePublicPushSubscription,
  type DeliveryClaim,
  type DeliveryKind,
} from "./repository";
import { sendWebPush, type PushSendResult } from "./sender";

type ScannerSchedule = Awaited<ReturnType<typeof getPublicScheduleDay>>;
type DeliveryAttemptOutcome = "sent" | "invalid" | "failed" | "skipped";
const PUSH_SEND_MAX_ATTEMPTS = 2;
const PUSH_SEND_CONCURRENCY = 8;

export type PublicPushScannerDependencies = Readonly<{
  listSubscriptions: () => Promise<readonly ActivePublicPushSubscription[]>;
  readSchedule: (input: { date: string; teacherId: string }) => Promise<ScannerSchedule>;
  claim: (input: {
    subscriptionId: string;
    subscriptionVersion: number;
    kind: DeliveryKind;
    deliveryKey: string;
    payload: PublicPushPayload;
    scheduledFor: Date;
  }) => Promise<DeliveryClaim | null>;
  finalize: (input: {
    deliveryId: string;
    leaseToken: string;
    outcome: "sent" | "failed" | "invalid";
    providerStatus: number | null;
  }) => Promise<void>;
  revoke: (subscriptionId: string, reason: "provider_gone") => Promise<void>;
  send: (endpoint: ActivePublicPushSubscription["endpoint"], payload: PublicPushPayload) => Promise<PushSendResult>;
}>;

export type PublicPushScanResult = Readonly<{
  scanned: boolean;
  subscriptions: number;
  claimed: number;
  sent: number;
  invalid: number;
  failed: number;
  skipped: number;
  scheduleErrors: number;
}>;

const defaultDependencies: PublicPushScannerDependencies = {
  listSubscriptions: listActivePublicPushSubscriptions,
  readSchedule: getPublicScheduleDay,
  claim: claimPublicPushDelivery,
  finalize: finalizePublicPushDelivery,
  revoke: revokePushSubscriptionById,
  send: sendWebPush,
};

function preferencesFor(subscription: ActivePublicPushSubscription): PublicPushPreferences {
  return {
    teacherId: subscription.teacherId,
    morningEnabled: subscription.morningTime !== null,
    morningTime: subscription.morningTime ?? "08:00",
    lessonReminderEnabled: subscription.lessonLeadMinutes !== null,
    lessonLeadMinutes: subscription.lessonLeadMinutes ?? 15,
  };
}

async function sendClaimedDelivery(input: {
  subscription: ActivePublicPushSubscription;
  kind: DeliveryKind;
  key: string;
  payload: PublicPushPayload;
  now: Date;
  dependencies: PublicPushScannerDependencies;
}): Promise<DeliveryAttemptOutcome> {
  const claim = await input.dependencies.claim({
    subscriptionId: input.subscription.id,
    subscriptionVersion: input.subscription.configVersion,
    kind: input.kind,
    deliveryKey: input.key,
    payload: input.payload,
    scheduledFor: input.now,
  });
  if (!claim) return "skipped";

  try {
    let result = await input.dependencies.send(input.subscription.endpoint, input.payload);
    // A transient provider/network failure is retried once while the same
    // delivery lease is held. The stable notification tag lets the browser
    // replace, rather than duplicate, an uncertain first display.
    if (result.kind === "failed" && PUSH_SEND_MAX_ATTEMPTS > 1) {
      result = await input.dependencies.send(input.subscription.endpoint, input.payload);
    }
    if (result.kind === "sent") {
      await input.dependencies.finalize({
        deliveryId: claim.id,
        leaseToken: claim.leaseToken,
        outcome: "sent",
        providerStatus: result.statusCode,
      });
      return "sent";
    }
    if (result.kind === "gone") {
      await input.dependencies.finalize({
        deliveryId: claim.id,
        leaseToken: claim.leaseToken,
        outcome: "invalid",
        providerStatus: result.statusCode,
      });
      await input.dependencies.revoke(input.subscription.id, "provider_gone");
      return "invalid";
    }
    await input.dependencies.finalize({
      deliveryId: claim.id,
      leaseToken: claim.leaseToken,
      outcome: "failed",
      providerStatus: result.statusCode,
    });
    return "failed";
  } catch {
    await input.dependencies.finalize({
      deliveryId: claim.id,
      leaseToken: claim.leaseToken,
      outcome: "failed",
      providerStatus: null,
    });
    return "failed";
  }
}

function addOutcome(
  result: { claimed: number; sent: number; invalid: number; failed: number; skipped: number },
  outcome: DeliveryAttemptOutcome,
): void {
  if (outcome === "skipped") {
    result.skipped += 1;
    return;
  }
  result.claimed += 1;
  result[outcome] += 1;
}

async function runWithConcurrency<T>(
  tasks: readonly (() => Promise<T>)[],
  concurrency: number,
): Promise<T[]> {
  const results: T[] = [];
  let nextTaskIndex = 0;

  const worker = async () => {
    while (nextTaskIndex < tasks.length) {
      const taskIndex = nextTaskIndex;
      nextTaskIndex += 1;
      results[taskIndex] = await tasks[taskIndex]();
    }
  };

  await Promise.all(Array.from(
    { length: Math.min(concurrency, tasks.length) },
    () => worker(),
  ));
  return results;
}

/**
 * Scans only the agreed Kyiv window. It reads a teacher's public schedule once,
 * then fans its due events out to that teacher's active browser subscriptions.
 */
export async function runPublicPushScanner(
  now: Date = new Date(),
  dependencies: PublicPushScannerDependencies = defaultDependencies,
): Promise<PublicPushScanResult> {
  const clock = getKyivDateTimeParts(now);
  if (!isWithinPushScanWindow(clock)) {
    return {
      scanned: false, subscriptions: 0, claimed: 0, sent: 0,
      invalid: 0, failed: 0, skipped: 0, scheduleErrors: 0,
    };
  }

  const subscriptions = await dependencies.listSubscriptions();
  const grouped = new Map<string, ActivePublicPushSubscription[]>();
  for (const subscription of subscriptions) {
    const values = grouped.get(subscription.teacherId) ?? [];
    values.push(subscription);
    grouped.set(subscription.teacherId, values);
  }

  const result = {
    scanned: true,
    subscriptions: subscriptions.length,
    claimed: 0,
    sent: 0,
    invalid: 0,
    failed: 0,
    skipped: 0,
    scheduleErrors: 0,
  };
  const subscriptionTasks: Array<() => Promise<DeliveryAttemptOutcome[]>> = [];

  for (const [teacherId, teacherSubscriptions] of grouped) {
    let day: ScannerSchedule;
    try {
      day = await dependencies.readSchedule({ date: clock.date, teacherId });
    } catch {
      result.scheduleErrors += 1;
      continue;
    }

    for (const subscription of teacherSubscriptions) {
      subscriptionTasks.push(async () => {
        const outcomes: DeliveryAttemptOutcome[] = [];
        const preferences = preferencesFor(subscription);
        if (isMorningDigestDue(preferences, clock)) {
          const key = await createPushDeliveryKey({
            subscriptionId: subscription.id,
            notificationKind: "morning",
            date: clock.date,
            scheduledMinute: 0,
          });
          const draft = createDailyDigestPayload(clock.date, day.items);
          outcomes.push(await sendClaimedDelivery({
            subscription,
            kind: "daily_digest",
            key,
            payload: { ...draft, tag: key },
            now,
            dependencies,
          }));
        }

        for (const item of day.items) {
          if (!isLessonReminderDue(item, preferences, clock)) continue;
          const startMinute = parseTimeToMinute(item.startTime);
          if (startMinute === null) continue;
          const key = await createPushDeliveryKey({
            subscriptionId: subscription.id,
            notificationKind: "lesson",
            date: item.occurrenceDate,
            scheduledMinute: startMinute,
            scheduleItemId: item.id,
          });
          const draft = createClassReminderPayload(item);
          outcomes.push(await sendClaimedDelivery({
            subscription,
            kind: "class_reminder",
            key,
            payload: { ...draft, tag: key },
            now,
            dependencies,
          }));
        }
        return outcomes;
      });
    }
  }

  const outcomesBySubscription = await runWithConcurrency(subscriptionTasks, PUSH_SEND_CONCURRENCY);
  for (const outcomes of outcomesBySubscription) {
    for (const outcome of outcomes) addOutcome(result, outcome);
  }

  return result;
}
