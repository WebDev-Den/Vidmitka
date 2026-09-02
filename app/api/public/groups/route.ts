import { NextResponse } from "next/server";

import { listPublicGroups } from "@/lib/schedule-v2/public-schedule";

export async function GET() {
  try {
    return NextResponse.json({ data: await listPublicGroups() }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
  } catch (error) {
    console.error("public_groups_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: { code: "GROUPS_UNAVAILABLE", message: "Не вдалося завантажити групи." } }, { status: 503 });
  }
}
