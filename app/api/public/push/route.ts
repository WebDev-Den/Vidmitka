import { NextRequest, NextResponse } from "next/server";

import {
  claimPublicPushTest,
  getPublicPushSettings,
  isPublicPushStorageReady,
  revokePublicPushSubscription,
  savePublicPushSettings,
} from "@/lib/public-push/repository";
import {
  createTestPushPayload,
  validateBrowserPushSubscription,
  validatePublicPushPreferences,
} from "@/lib/public-push/rules";
import type { BrowserPushSubscription } from "@/lib/public-push/rules";
import {
  getPublicVapidKey,
  isWebPushConfigured,
  sendWebPush,
} from "@/lib/public-push/sender";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 16_384;
const noStoreHeaders = { "Cache-Control": "no-store, max-age=0", Vary: "Origin" };

type ParsedBody =
  | Readonly<{ ok: true; value: Record<string, unknown> }>
  | Readonly<{ ok: false; response: NextResponse }>;
type ParsedSubscription =
  | Readonly<{ ok: true; value: BrowserPushSubscription }>
  | Readonly<{ ok: false; response: NextResponse }>;

function response(data: unknown, status = 200): NextResponse {
  return NextResponse.json({ data }, { status, headers: noStoreHeaders });
}

function problem(
  message: string,
  status = 400,
  extraHeaders?: Readonly<Record<string, string>>,
  code?: string,
): NextResponse {
  return NextResponse.json({ error: { message, ...(code ? { code } : {}) } }, {
    status,
    headers: { ...noStoreHeaders, ...extraHeaders },
  });
}

function databaseErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object" || !("code" in error)) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

function pushFailure(action: "read" | "save" | "disable", error: unknown, fallback: string): NextResponse {
  const databaseCode = databaseErrorCode(error);
  if (databaseCode === "42P01" || databaseCode === "42703") {
    console.error("public_push_storage_not_ready", { action, databaseCode });
    return problem(
      "Сховище сповіщень на сервері ще не підготовлене. Спробуйте пізніше.",
      503,
      undefined,
      "PUSH_STORAGE_NOT_READY",
    );
  }

  console.error("public_push_failed", { action, databaseCode: databaseCode ?? "unknown" });
  return problem(fallback, 503, undefined, "PUSH_UNAVAILABLE");
}

function hasSameOrigin(request: NextRequest): boolean {
  return request.headers.get("origin") === request.nextUrl.origin;
}

async function parseBody(request: NextRequest): Promise<ParsedBody> {
  if (!hasSameOrigin(request)) {
    return { ok: false, response: problem("Запит має надходити з цього сайту.", 403) };
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return { ok: false, response: problem("Очікується JSON-запит.", 415) };
  }

  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > MAX_BODY_BYTES) {
    return { ok: false, response: problem("Запит із налаштуваннями завеликий.", 413) };
  }
  try {
    const value: unknown = JSON.parse(body);
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return { ok: false, response: problem("Перевірте дані сповіщень.") };
    }
    return { ok: true, value: value as Record<string, unknown> };
  } catch {
    return { ok: false, response: problem("Перевірте JSON налаштувань.") };
  }
}

function readSubscription(value: unknown): ParsedSubscription {
  const parsed = validateBrowserPushSubscription(value);
  return parsed.ok ? { ok: true, value: parsed.value } : { ok: false, response: problem(parsed.message) };
}

export async function GET() {
  let storageReady = false;
  try {
    storageReady = await isPublicPushStorageReady();
  } catch (error) {
    // The browser only needs a safe availability state here; no DB details belong in this response.
    console.error("public_push_storage_check_failed", { databaseCode: databaseErrorCode(error) ?? "unknown" });
  }

  return response({
    vapidPublicKey: isWebPushConfigured() ? getPublicVapidKey() : null,
    storageReady,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await parseBody(request);
    if (!body.ok) return body.response;

    const parsedSubscription = readSubscription(body.value.subscription);
    if (!parsedSubscription.ok) return parsedSubscription.response;

    if (body.value.action === "status") {
      const settings = await getPublicPushSettings(parsedSubscription.value);
      return response({ settings });
    }
    if (body.value.action !== "test") return problem("Невідома дія сповіщень.");
    if (!isWebPushConfigured()) {
      return problem("Сповіщення ще не налаштовані на сервері.", 503);
    }

    const claim = await claimPublicPushTest(parsedSubscription.value);
    if (claim.kind === "missing") {
      return problem("Спочатку увімкніть і збережіть сповіщення для цього пристрою.", 409);
    }
    if (claim.kind === "cooldown") {
      return problem("Тестове сповіщення можна надіслати раз на хвилину.", 429, { "Retry-After": "60" });
    }

    const sent = await sendWebPush(claim.endpoint, createTestPushPayload());
    if (sent.kind === "sent") return response({ sent: true }, 202);
    if (sent.kind === "gone") {
      await revokePublicPushSubscription(parsedSubscription.value, "provider_gone");
      return problem("Підписка застаріла. Увімкніть і збережіть сповіщення знову.", 410);
    }
    return problem("Не вдалося надіслати тестове сповіщення. Спробуйте пізніше.", 503);
  } catch (error) {
    return pushFailure("read", error, "Не вдалося прочитати налаштування сповіщень.");
  }
}

export async function PUT(request: NextRequest) {
  try {
    if (!isWebPushConfigured()) {
      return problem("Сповіщення ще не налаштовані на сервері.", 503);
    }
    const body = await parseBody(request);
    if (!body.ok) return body.response;

    const parsedSubscription = readSubscription(body.value.subscription);
    if (!parsedSubscription.ok) return parsedSubscription.response;
    const parsedPreferences = validatePublicPushPreferences(body.value.preferences);
    if (!parsedPreferences.ok) return problem(parsedPreferences.message);

    const saved = await savePublicPushSettings({
      subscription: parsedSubscription.value,
      preferences: parsedPreferences.value,
    });
    if (!saved) return problem("Оберіть активного викладача.");
    return response({ saved: true });
  } catch (error) {
    return pushFailure("save", error, "Не вдалося зберегти налаштування сповіщень.");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await parseBody(request);
    if (!body.ok) return body.response;

    const parsedSubscription = readSubscription(body.value.subscription);
    if (!parsedSubscription.ok) return parsedSubscription.response;
    await revokePublicPushSubscription(parsedSubscription.value);
    return new NextResponse(null, { status: 204, headers: noStoreHeaders });
  } catch (error) {
    return pushFailure("disable", error, "Не вдалося вимкнути сповіщення.");
  }
}
