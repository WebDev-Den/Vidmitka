import "server-only";

import { createHash, randomUUID } from "node:crypto";

import { getDb } from "@/lib/db";

import type {
  AdminPushManualDelivery,
  AdminPushScanRun,
  AdminPushSubscription,
} from "./admin-types";
import type { BrowserPushSubscription, PublicPushPreferences } from "./rules";
import type { PublicPushPayload, StoredPushEndpoint } from "./sender";

export type { BrowserPushSubscription, PublicPushPreferences } from "./rules";

export type ActivePublicPushSubscription = Readonly<{
  id: string;
  configVersion: number;
  teacherId: string;
  teacherName: string;
  morningTime: string | null;
  lessonLeadMinutes: number | null;
  endpoint: StoredPushEndpoint;
}>;

export type DeliveryClaim = Readonly<{ id: string; leaseToken: string }>;
export type DeliveryKind = "daily_digest" | "class_reminder";
export type DeliveryOutcome = "sent" | "failed" | "invalid";
export type ManualDeliveryOutcome = DeliveryOutcome;
export type PublicPushTestClaim =
  | Readonly<{ kind: "claimed"; endpoint: StoredPushEndpoint }>
  | Readonly<{ kind: "cooldown" }>
  | Readonly<{ kind: "missing" }>;

type SettingsRow = Readonly<{
  teacher_id: string;
  daily_digest_time: string | null;
  class_reminder_minutes: number | null;
}>;

type ActiveSubscriptionRow = Readonly<{
  id: string;
  config_version: number;
  teacher_id: string;
  teacher_name: string;
  daily_digest_time: string | null;
  class_reminder_minutes: number | null;
  endpoint_url: string;
  expiration_time: string | Date | null;
  p256dh_key: string;
  auth_secret: string;
}>;

type StoredEndpointRow = Pick<
  ActiveSubscriptionRow,
  "endpoint_url" | "expiration_time" | "p256dh_key" | "auth_secret"
>;

type StorageReadinessRow = Readonly<{
  subscriptions_ready: boolean;
  deliveries_ready: boolean;
  test_cooldown_ready: boolean;
}>;

type AdminOperationsReadinessRow = Readonly<{
  subscriptions_ready: boolean;
  deliveries_ready: boolean;
  scan_runs_ready: boolean;
  manual_deliveries_ready: boolean;
}>;

type AdminSubscriptionRow = Readonly<{
  id: string;
  teacher_name: string;
  daily_digest_time: string | null;
  class_reminder_minutes: number | null;
  last_seen_at: string | Date;
}>;

type ScanRunRow = Readonly<{
  id: string;
  status: AdminPushScanRun["status"];
  scanned: boolean;
  subscriptions_count: number;
  claimed_count: number;
  sent_count: number;
  invalid_count: number;
  failed_count: number;
  skipped_count: number;
  schedule_error_count: number;
  failure_code: string | null;
  created_at: string | Date;
}>;

type ManualDeliveryRow = Readonly<{
  id: string;
  teacher_name: string;
  notification_kind: AdminPushManualDelivery["kind"];
  scheduled_date: string;
  scheduled_time: string;
  status: AdminPushManualDelivery["status"];
  provider_status: number | null;
  created_at: string | Date;
}>;

function endpointHash(endpoint: string): string {
  return createHash("sha256").update(endpoint).digest("hex");
}

function timeValue(value: string | null): string | null {
  return value ? value.slice(0, 5) : null;
}

function settingsFromRow(row: SettingsRow): PublicPushPreferences {
  return {
    teacherId: row.teacher_id,
    morningEnabled: row.daily_digest_time !== null,
    morningTime: timeValue(row.daily_digest_time) ?? "08:00",
    lessonReminderEnabled: row.class_reminder_minutes !== null,
    lessonLeadMinutes: row.class_reminder_minutes ?? 15,
  };
}

function toIsoTime(value: number | null): string | null {
  if (value === null) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function toIsoDate(value: string | Date): string {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : "";
}

function storedEndpointFromRow(row: StoredEndpointRow): StoredPushEndpoint {
  return {
    endpoint: row.endpoint_url,
    expirationTime: row.expiration_time ? new Date(row.expiration_time).toISOString() : null,
    p256dh: row.p256dh_key,
    auth: row.auth_secret,
  };
}

function activeSubscriptionFromRow(row: ActiveSubscriptionRow): ActivePublicPushSubscription {
  return {
    id: row.id,
    configVersion: Number(row.config_version),
    teacherId: row.teacher_id,
    teacherName: row.teacher_name,
    morningTime: timeValue(row.daily_digest_time),
    lessonLeadMinutes: row.class_reminder_minutes === null ? null : Number(row.class_reminder_minutes),
    endpoint: storedEndpointFromRow(row),
  };
}

/**
 * Checks the schema capabilities needed by the public browser lifecycle without
 * exposing table names or database errors to a visitor.
 */
export async function isPublicPushStorageReady(): Promise<boolean> {
  const sql = getDb();
  const [row] = await sql`
    SELECT
      to_regclass('public_push_subscriptions') IS NOT NULL AS subscriptions_ready,
      to_regclass('public_push_deliveries') IS NOT NULL AS deliveries_ready,
      EXISTS(
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'public_push_subscriptions'
          AND column_name = 'last_test_notification_at'
      ) AS test_cooldown_ready
  ` as unknown as StorageReadinessRow[];

  return row?.subscriptions_ready === true
    && row.deliveries_ready === true
    && row.test_cooldown_ready === true;
}

export async function isAdminPublicPushOperationsReady(): Promise<boolean> {
  const sql = getDb();
  const [row] = await sql`
    SELECT
      to_regclass('public_push_subscriptions') IS NOT NULL AS subscriptions_ready,
      to_regclass('public_push_deliveries') IS NOT NULL AS deliveries_ready,
      to_regclass('public_push_scan_runs') IS NOT NULL AS scan_runs_ready,
      to_regclass('public_push_manual_deliveries') IS NOT NULL AS manual_deliveries_ready
  ` as unknown as AdminOperationsReadinessRow[];
  return row?.subscriptions_ready === true
    && row.deliveries_ready === true
    && row.scan_runs_ready === true
    && row.manual_deliveries_ready === true;
}

export async function getPublicPushSettings(
  subscription: BrowserPushSubscription,
): Promise<PublicPushPreferences | null> {
  const sql = getDb();
  const [row] = await sql`
    SELECT
      subscription.teacher_id::TEXT,
      subscription.daily_digest_time::TEXT,
      subscription.class_reminder_minutes
    FROM public_push_subscriptions AS subscription
    JOIN teachers AS teacher ON teacher.id = subscription.teacher_id AND teacher.is_active
    WHERE subscription.endpoint_hash = ${endpointHash(subscription.endpoint)}
      AND subscription.endpoint_url = ${subscription.endpoint}
      AND subscription.p256dh_key = ${subscription.keys.p256dh}
      AND subscription.auth_secret = ${subscription.keys.auth}
      AND subscription.is_active
    LIMIT 1
  ` as unknown as SettingsRow[];
  return row ? settingsFromRow(row) : null;
}

export async function savePublicPushSettings(input: {
  subscription: BrowserPushSubscription;
  preferences: PublicPushPreferences;
}): Promise<boolean> {
  const sql = getDb();
  const dailyDigestTime = input.preferences.morningEnabled ? input.preferences.morningTime : null;
  const classReminderMinutes = input.preferences.lessonReminderEnabled
    ? input.preferences.lessonLeadMinutes
    : null;
  const rows = await sql`
    INSERT INTO public_push_subscriptions (
      endpoint_hash, endpoint_url, p256dh_key, auth_secret, expiration_time,
      teacher_id, daily_digest_time, class_reminder_minutes,
      is_active, revoked_at, revoked_reason, last_seen_at
    )
    SELECT
      ${endpointHash(input.subscription.endpoint)},
      ${input.subscription.endpoint},
      ${input.subscription.keys.p256dh},
      ${input.subscription.keys.auth},
      ${toIsoTime(input.subscription.expirationTime)},
      teacher.id,
      ${dailyDigestTime}::TIME,
      ${classReminderMinutes},
      TRUE, NULL, NULL, NOW()
    FROM teachers AS teacher
    WHERE teacher.id = ${input.preferences.teacherId}::UUID AND teacher.is_active
    ON CONFLICT (endpoint_hash) DO UPDATE SET
      endpoint_url = EXCLUDED.endpoint_url,
      p256dh_key = EXCLUDED.p256dh_key,
      auth_secret = EXCLUDED.auth_secret,
      expiration_time = EXCLUDED.expiration_time,
      teacher_id = EXCLUDED.teacher_id,
      daily_digest_time = EXCLUDED.daily_digest_time,
      class_reminder_minutes = EXCLUDED.class_reminder_minutes,
      config_version = CASE WHEN
        public_push_subscriptions.endpoint_url IS DISTINCT FROM EXCLUDED.endpoint_url
        OR public_push_subscriptions.p256dh_key IS DISTINCT FROM EXCLUDED.p256dh_key
        OR public_push_subscriptions.auth_secret IS DISTINCT FROM EXCLUDED.auth_secret
        OR public_push_subscriptions.expiration_time IS DISTINCT FROM EXCLUDED.expiration_time
        OR public_push_subscriptions.teacher_id IS DISTINCT FROM EXCLUDED.teacher_id
        OR public_push_subscriptions.daily_digest_time IS DISTINCT FROM EXCLUDED.daily_digest_time
        OR public_push_subscriptions.class_reminder_minutes IS DISTINCT FROM EXCLUDED.class_reminder_minutes
        OR NOT public_push_subscriptions.is_active
        THEN public_push_subscriptions.config_version + 1
        ELSE public_push_subscriptions.config_version
      END,
      is_active = TRUE,
      revoked_at = NULL,
      revoked_reason = NULL,
      last_seen_at = NOW(),
      updated_at = NOW()
    RETURNING id
  ` as unknown as Array<{ id: string }>;
  return rows.length > 0;
}

export async function revokePublicPushSubscription(
  subscription: BrowserPushSubscription,
  reason: "user" | "permission" | "provider_gone" | "invalid_subscription" = "user",
): Promise<void> {
  const sql = getDb();
  await sql`
    UPDATE public_push_subscriptions
    SET
      is_active = FALSE,
      revoked_at = NOW(),
      revoked_reason = ${reason},
      updated_at = NOW()
    WHERE endpoint_hash = ${endpointHash(subscription.endpoint)}
      AND endpoint_url = ${subscription.endpoint}
      AND p256dh_key = ${subscription.keys.p256dh}
      AND auth_secret = ${subscription.keys.auth}
      AND is_active
  `;
}

/**
 * Atomically grants a test send only to the exact active browser subscription.
 * A public browser endpoint acts as a narrow capability here, so a short
 * database-backed cooldown protects the unauthenticated test endpoint.
 */
export async function claimPublicPushTest(
  subscription: BrowserPushSubscription,
): Promise<PublicPushTestClaim> {
  const sql = getDb();
  const [claimed] = await sql`
    UPDATE public_push_subscriptions AS subscription
    SET
      last_test_notification_at = NOW(),
      last_seen_at = NOW(),
      updated_at = NOW()
    FROM teachers AS teacher
    WHERE subscription.teacher_id = teacher.id
      AND teacher.is_active
      AND subscription.endpoint_hash = ${endpointHash(subscription.endpoint)}
      AND subscription.endpoint_url = ${subscription.endpoint}
      AND subscription.p256dh_key = ${subscription.keys.p256dh}
      AND subscription.auth_secret = ${subscription.keys.auth}
      AND subscription.is_active
      AND (
        subscription.last_test_notification_at IS NULL
        OR subscription.last_test_notification_at < NOW() - INTERVAL '60 seconds'
      )
    RETURNING
      subscription.endpoint_url,
      subscription.expiration_time,
      subscription.p256dh_key,
      subscription.auth_secret
  ` as unknown as StoredEndpointRow[];
  if (claimed) return { kind: "claimed", endpoint: storedEndpointFromRow(claimed) };

  const [active] = await sql`
    SELECT 1
    FROM public_push_subscriptions AS subscription
    JOIN teachers AS teacher ON teacher.id = subscription.teacher_id AND teacher.is_active
    WHERE subscription.endpoint_hash = ${endpointHash(subscription.endpoint)}
      AND subscription.endpoint_url = ${subscription.endpoint}
      AND subscription.p256dh_key = ${subscription.keys.p256dh}
      AND subscription.auth_secret = ${subscription.keys.auth}
      AND subscription.is_active
    LIMIT 1
  ` as unknown as Array<{ exists: number }>;
  return active ? { kind: "cooldown" } : { kind: "missing" };
}

export async function listActivePublicPushSubscriptions(): Promise<ActivePublicPushSubscription[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT
      subscription.id::TEXT,
      subscription.config_version,
      subscription.teacher_id::TEXT,
      teacher.display_name AS teacher_name,
      subscription.daily_digest_time::TEXT,
      subscription.class_reminder_minutes,
      subscription.endpoint_url,
      subscription.expiration_time,
      subscription.p256dh_key,
      subscription.auth_secret
    FROM public_push_subscriptions AS subscription
    JOIN teachers AS teacher ON teacher.id = subscription.teacher_id AND teacher.is_active
    WHERE subscription.is_active
      AND (subscription.daily_digest_time IS NOT NULL OR subscription.class_reminder_minutes IS NOT NULL)
    ORDER BY subscription.teacher_id, subscription.id
  ` as unknown as ActiveSubscriptionRow[];

  return rows.map(activeSubscriptionFromRow);
}

export async function findActivePublicPushSubscriptionById(
  subscriptionId: string,
): Promise<ActivePublicPushSubscription | null> {
  const sql = getDb();
  const [row] = await sql`
    SELECT
      subscription.id::TEXT,
      subscription.config_version,
      subscription.teacher_id::TEXT,
      teacher.display_name AS teacher_name,
      subscription.daily_digest_time::TEXT,
      subscription.class_reminder_minutes,
      subscription.endpoint_url,
      subscription.expiration_time,
      subscription.p256dh_key,
      subscription.auth_secret
    FROM public_push_subscriptions AS subscription
    JOIN teachers AS teacher ON teacher.id = subscription.teacher_id AND teacher.is_active
    WHERE subscription.id = ${subscriptionId}::UUID
      AND subscription.is_active
      AND (subscription.daily_digest_time IS NOT NULL OR subscription.class_reminder_minutes IS NOT NULL)
    LIMIT 1
  ` as unknown as ActiveSubscriptionRow[];
  return row ? activeSubscriptionFromRow(row) : null;
}

export async function listAdminPublicPushSubscriptions(): Promise<AdminPushSubscription[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT
      subscription.id::TEXT,
      teacher.display_name AS teacher_name,
      subscription.daily_digest_time::TEXT,
      subscription.class_reminder_minutes,
      subscription.last_seen_at
    FROM public_push_subscriptions AS subscription
    JOIN teachers AS teacher ON teacher.id = subscription.teacher_id AND teacher.is_active
    WHERE subscription.is_active
      AND (subscription.daily_digest_time IS NOT NULL OR subscription.class_reminder_minutes IS NOT NULL)
    ORDER BY teacher.display_name, subscription.last_seen_at DESC, subscription.id
    LIMIT 250
  ` as unknown as AdminSubscriptionRow[];
  return rows.map((row) => ({
    id: row.id,
    teacherName: row.teacher_name,
    morningTime: timeValue(row.daily_digest_time),
    lessonLeadMinutes: row.class_reminder_minutes === null ? null : Number(row.class_reminder_minutes),
    lastSeenAt: toIsoDate(row.last_seen_at),
  }));
}

export async function listRecentPublicPushScanRuns(limit = 50): Promise<AdminPushScanRun[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT
      id::TEXT, status, scanned,
      subscriptions_count, claimed_count, sent_count, invalid_count, failed_count,
      skipped_count, schedule_error_count, failure_code, created_at
    FROM public_push_scan_runs
    ORDER BY created_at DESC
    LIMIT ${Math.min(Math.max(limit, 1), 100)}
  ` as unknown as ScanRunRow[];
  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    scanned: row.scanned,
    subscriptions: Number(row.subscriptions_count),
    claimed: Number(row.claimed_count),
    sent: Number(row.sent_count),
    invalid: Number(row.invalid_count),
    failed: Number(row.failed_count),
    skipped: Number(row.skipped_count),
    scheduleErrors: Number(row.schedule_error_count),
    failureCode: row.failure_code,
    createdAt: toIsoDate(row.created_at),
  }));
}

export async function listRecentPublicPushManualDeliveries(limit = 50): Promise<AdminPushManualDelivery[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT
      delivery.id::TEXT,
      teacher.display_name AS teacher_name,
      delivery.notification_kind,
      delivery.scheduled_date::TEXT,
      delivery.scheduled_time::TEXT,
      delivery.status,
      delivery.provider_status,
      delivery.created_at
    FROM public_push_manual_deliveries AS delivery
    JOIN public_push_subscriptions AS subscription ON subscription.id = delivery.subscription_id
    JOIN teachers AS teacher ON teacher.id = subscription.teacher_id
    ORDER BY delivery.created_at DESC
    LIMIT ${Math.min(Math.max(limit, 1), 100)}
  ` as unknown as ManualDeliveryRow[];
  return rows.map((row) => ({
    id: row.id,
    teacherName: row.teacher_name,
    kind: row.notification_kind,
    scheduledDate: row.scheduled_date,
    scheduledTime: timeValue(row.scheduled_time) ?? "",
    status: row.status,
    providerStatus: row.provider_status === null ? null : Number(row.provider_status),
    createdAt: toIsoDate(row.created_at),
  }));
}

export async function recordPublicPushScanRun(input: {
  status: AdminPushScanRun["status"];
  scanned: boolean;
  subscriptions: number;
  claimed: number;
  sent: number;
  invalid: number;
  failed: number;
  skipped: number;
  scheduleErrors: number;
  failureCode?: string | null;
}): Promise<void> {
  const sql = getDb();
  await sql`
    INSERT INTO public_push_scan_runs (
      status, scanned, subscriptions_count, claimed_count, sent_count,
      invalid_count, failed_count, skipped_count, schedule_error_count, failure_code
    ) VALUES (
      ${input.status}, ${input.scanned}, ${input.subscriptions}, ${input.claimed}, ${input.sent},
      ${input.invalid}, ${input.failed}, ${input.skipped}, ${input.scheduleErrors}, ${input.failureCode ?? null}
    )
  `;
}

export async function startPublicPushManualDelivery(input: {
  subscriptionId: string;
  kind: DeliveryKind;
  scheduledDate: string;
  scheduledTime: string;
}): Promise<string | null> {
  const sql = getDb();
  const [row] = await sql`
    INSERT INTO public_push_manual_deliveries (
      subscription_id, notification_kind, scheduled_date, scheduled_time
    ) VALUES (
      ${input.subscriptionId}::UUID, ${input.kind}, ${input.scheduledDate}::DATE, ${input.scheduledTime}::TIME
    )
    RETURNING id::TEXT
  ` as unknown as Array<{ id: string }>;
  return row?.id ?? null;
}

export async function finalizePublicPushManualDelivery(input: {
  deliveryId: string;
  outcome: ManualDeliveryOutcome;
  providerStatus: number | null;
}): Promise<void> {
  const sql = getDb();
  await sql`
    UPDATE public_push_manual_deliveries
    SET
      status = ${input.outcome},
      provider_status = ${input.providerStatus},
      failure_code = ${input.outcome === "failed" ? "provider_error" : null},
      sent_at = CASE WHEN ${input.outcome} = 'sent' THEN NOW() ELSE NULL END,
      updated_at = NOW()
    WHERE id = ${input.deliveryId}::UUID
      AND status = 'pending'
  `;
}

export async function claimPublicPushDelivery(input: {
  subscriptionId: string;
  subscriptionVersion: number;
  kind: DeliveryKind;
  deliveryKey: string;
  payload: PublicPushPayload;
  scheduledFor: Date;
}): Promise<DeliveryClaim | null> {
  const sql = getDb();
  const leaseToken = randomUUID();
  const [row] = await sql`
    INSERT INTO public_push_deliveries (
      subscription_id, subscription_version, notification_kind, delivery_key,
      scheduled_for, payload, status, attempt_count, lease_token, lease_expires_at
    ) VALUES (
      ${input.subscriptionId}::UUID,
      ${input.subscriptionVersion},
      ${input.kind},
      ${input.deliveryKey},
      ${input.scheduledFor.toISOString()},
      ${JSON.stringify(input.payload)}::JSONB,
      'leased', 1, ${leaseToken}::UUID, NOW() + INTERVAL '5 minutes'
    )
    ON CONFLICT (subscription_id, delivery_key) DO UPDATE SET
      status = 'leased',
      attempt_count = public_push_deliveries.attempt_count + 1,
      lease_token = EXCLUDED.lease_token,
      lease_expires_at = NOW() + INTERVAL '5 minutes',
      updated_at = NOW()
    WHERE public_push_deliveries.status = 'leased'
      AND public_push_deliveries.lease_expires_at < NOW()
      AND public_push_deliveries.attempt_count < 5
    RETURNING id::TEXT, lease_token::TEXT
  ` as unknown as Array<{ id: string; lease_token: string }>;
  return row ? { id: row.id, leaseToken: row.lease_token } : null;
}

export async function finalizePublicPushDelivery(input: {
  deliveryId: string;
  leaseToken: string;
  outcome: DeliveryOutcome;
  providerStatus: number | null;
}): Promise<void> {
  const sql = getDb();
  await sql`
    UPDATE public_push_deliveries
    SET
      status = ${input.outcome},
      provider_status = ${input.providerStatus},
      last_error_code = ${input.outcome === "failed" ? "provider_error" : null},
      sent_at = CASE WHEN ${input.outcome} = 'sent' THEN NOW() ELSE NULL END,
      lease_token = NULL,
      lease_expires_at = NULL,
      updated_at = NOW()
    WHERE id = ${input.deliveryId}::UUID
      AND lease_token = ${input.leaseToken}::UUID
      AND status = 'leased'
  `;
}

export async function revokePushSubscriptionById(
  subscriptionId: string,
  reason: "provider_gone" | "invalid_subscription",
): Promise<void> {
  const sql = getDb();
  await sql`
    UPDATE public_push_subscriptions
    SET
      is_active = FALSE,
      revoked_at = NOW(),
      revoked_reason = ${reason},
      updated_at = NOW()
    WHERE id = ${subscriptionId}::UUID AND is_active
  `;
}
