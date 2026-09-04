import { NextRequest, NextResponse } from "next/server";

import { getPublicScheduleDay, getPublicScheduleWeek } from "@/lib/schedule-v2/public-schedule";
import { isPublicDateKey, isPublicUuid } from "@/lib/schedule-v2/public-schedule-state";

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date") ?? undefined;
  const groupId = request.nextUrl.searchParams.get("groupId");
  const teacherId = request.nextUrl.searchParams.get("teacherId");
  const view = request.nextUrl.searchParams.get("view");
  if (date && !isPublicDateKey(date)) {
    return NextResponse.json({ error: { code: "INVALID_DATE", message: "Дата має формат YYYY-MM-DD." } }, { status: 400 });
  }
  if (groupId && !isPublicUuid(groupId)) {
    return NextResponse.json({ error: { code: "GROUP_REQUIRED", message: "Оберіть коректну групу." } }, { status: 400 });
  }
  if (teacherId && !isPublicUuid(teacherId)) {
    return NextResponse.json({ error: { code: "INVALID_TEACHER", message: "Оберіть коректного викладача." } }, { status: 400 });
  }
  if (view === "week" && !groupId) {
    return NextResponse.json({ error: { code: "GROUP_REQUIRED", message: "Оберіть групу." } }, { status: 400 });
  }
  try {
    const data = view === "week"
      ? await getPublicScheduleWeek({ date, groupId, teacherId })
      : await getPublicScheduleDay({ date, groupId, teacherId });
    return NextResponse.json({ data }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } });
  } catch (error) {
    console.error("public_schedule_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: { code: "SCHEDULE_UNAVAILABLE", message: "Не вдалося завантажити розклад." } }, { status: 503 });
  }
}
