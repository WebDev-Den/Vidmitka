import { NextRequest, NextResponse } from "next/server";

import { getPublicScheduleDay, getPublicScheduleWeek } from "@/lib/schedule-v2/public-schedule";

export async function GET(request: NextRequest) {
  const date=request.nextUrl.searchParams.get("date") ?? undefined;
  const groupId=request.nextUrl.searchParams.get("groupId");
  const view=request.nextUrl.searchParams.get("view");
  const dateValue = date && /^\d{4}-\d{2}-\d{2}$/u.test(date) ? Date.parse(`${date}T00:00:00Z`) : Number.NaN;
  if (date && (!Number.isFinite(dateValue) || new Date(dateValue).toISOString().slice(0, 10) !== date)) {
    return NextResponse.json({ error: { code: "INVALID_DATE", message: "Дата має формат YYYY-MM-DD." } }, { status: 400 });
  }
  if (!groupId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(groupId)) {
    return NextResponse.json({ error: { code: "GROUP_REQUIRED", message: "Оберіть коректну групу." } }, { status: 400 });
  }
  try {
    const data=view === "week" ? await getPublicScheduleWeek({date,groupId}) : await getPublicScheduleDay({date,groupId});
    return NextResponse.json({ data }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } });
  } catch (error) {
    console.error("public_schedule_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: { code: "SCHEDULE_UNAVAILABLE", message: "Не вдалося завантажити розклад." } }, { status: 503 });
  }
}
