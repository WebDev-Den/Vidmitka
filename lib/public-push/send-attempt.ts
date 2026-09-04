import "server-only";

import type { PublicPushPayload } from "./rules";
import { sendWebPush, type PushSendResult, type StoredPushEndpoint } from "./sender";

const MAX_SEND_ATTEMPTS = 2;

/** Sends once more only for a transient provider/network failure. */
export async function sendWebPushWithRetry(
  endpoint: StoredPushEndpoint,
  payload: PublicPushPayload,
  send: typeof sendWebPush = sendWebPush,
): Promise<PushSendResult> {
  let result = await send(endpoint, payload);
  if (result.kind === "failed" && MAX_SEND_ATTEMPTS > 1) {
    result = await send(endpoint, payload);
  }
  return result;
}
