import "server-only";

import { createHash } from "node:crypto";
import * as webpush from "web-push";

import type { PublicPushPayload as RulesPushPayload } from "./rules";

export type PublicPushPayload = RulesPushPayload;

export type StoredPushEndpoint = Readonly<{
  endpoint: string;
  expirationTime: string | null;
  p256dh: string;
  auth: string;
}>;

export type PushSendResult =
  | Readonly<{ kind: "sent"; statusCode: number }>
  | Readonly<{ kind: "gone"; statusCode: 404 | 410 }>
  | Readonly<{ kind: "failed"; statusCode: number | null }>;

type VapidConfiguration = Readonly<{
  publicKey: string;
  privateKey: string;
  subject: string;
}>;

function readVapidConfiguration(): VapidConfiguration | null {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() ?? "";
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim() ?? "";
  const subject = process.env.VAPID_SUBJECT?.trim() ?? "";
  if (!publicKey || !privateKey || !subject) return null;
  if (!/^mailto:[^\s@]+@[^\s@]+$/u.test(subject) && !/^https:\/\/[^\s]+$/u.test(subject)) return null;
  return { publicKey, privateKey, subject };
}

export function getPublicVapidKey(): string | null {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() || null;
}

export function isWebPushConfigured(): boolean {
  return readVapidConfiguration() !== null;
}

/**
 * RFC 8030 limits the transport Topic to 32 URL-safe Base64 characters.
 * The service worker still receives the descriptive payload tag unchanged.
 */
function transportTopic(tag: string): string {
  return createHash("sha256").update(tag).digest("base64url").slice(0, 32);
}

export async function sendWebPush(
  endpoint: StoredPushEndpoint,
  payload: PublicPushPayload,
): Promise<PushSendResult> {
  const vapid = readVapidConfiguration();
  if (!vapid) return { kind: "failed", statusCode: null };

  try {
    const result = await webpush.sendNotification({
      endpoint: endpoint.endpoint,
      expirationTime: endpoint.expirationTime ? Date.parse(endpoint.expirationTime) : null,
      keys: { p256dh: endpoint.p256dh, auth: endpoint.auth },
    }, JSON.stringify(payload), {
      vapidDetails: {
        subject: vapid.subject,
        publicKey: vapid.publicKey,
        privateKey: vapid.privateKey,
      },
      TTL: 120,
      urgency: "high",
      topic: transportTopic(payload.tag),
      timeout: 10_000,
    });
    return { kind: "sent", statusCode: result.statusCode };
  } catch (error) {
    const statusCode = error instanceof webpush.WebPushError ? error.statusCode : null;
    if (statusCode === 404 || statusCode === 410) return { kind: "gone", statusCode };
    return { kind: "failed", statusCode };
  }
}
