import { Receiver } from "@upstash/qstash";
import { NextRequest, NextResponse } from "next/server";

import { runPublicPushScanner } from "@/lib/public-push/scanner";
import { isWebPushConfigured } from "@/lib/public-push/sender";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_QSTASH_BODY_BYTES = 1_024;

function scannerUrl(): string | null {
  const value = process.env.PUSH_SCANNER_URL?.trim() ?? "";
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.pathname !== "/api/internal/push/scan" || url.search || url.hash) return null;
    return url.href;
  } catch {
    return null;
  }
}

function isExpectedBody(value: unknown): boolean {
  return Boolean(value)
    && typeof value === "object"
    && !Array.isArray(value)
    && (value as Record<string, unknown>).version === 1;
}

export async function POST(request: NextRequest) {
  const expectedUrl = scannerUrl();
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY?.trim() ?? "";
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY?.trim() ?? "";
  if (!expectedUrl || !currentSigningKey || !nextSigningKey) {
    return NextResponse.json({ error: "Scanner configuration is unavailable." }, { status: 503 });
  }

  const signature = request.headers.get("upstash-signature");
  if (!signature) return new NextResponse("Missing QStash signature.", { status: 403 });
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_QSTASH_BODY_BYTES) {
    return new NextResponse("Request body is too large.", { status: 413 });
  }

  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > MAX_QSTASH_BODY_BYTES) {
    return new NextResponse("Request body is too large.", { status: 413 });
  }

  try {
    const receiver = new Receiver({ currentSigningKey, nextSigningKey });
    const verified = await receiver.verify({
      signature,
      body,
      url: expectedUrl,
      upstashRegion: request.headers.get("upstash-region") ?? undefined,
      clockTolerance: 60,
    });
    if (!verified) return new NextResponse("Invalid QStash signature.", { status: 403 });
  } catch {
    return new NextResponse("Invalid QStash signature.", { status: 403 });
  }

  try {
    if (!isExpectedBody(JSON.parse(body))) {
      return new NextResponse("Unexpected scanner payload.", { status: 400 });
    }
  } catch {
    return new NextResponse("Unexpected scanner payload.", { status: 400 });
  }

  if (!isWebPushConfigured()) {
    return NextResponse.json({ error: "Web Push configuration is unavailable." }, { status: 503 });
  }

  try {
    const result = await runPublicPushScanner();
    if (result.scheduleErrors > 0) {
      return NextResponse.json({ error: "Schedule scanner did not finish." }, { status: 503 });
    }
    return NextResponse.json({ data: result }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Push scanner is unavailable." }, { status: 503 });
  }
}
