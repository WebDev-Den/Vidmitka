import { NextRequest, NextResponse } from "next/server";

import { availableRoomsForPeriod, parseFreeRoomPeriodNumber } from "@/lib/schedule-v2/free-rooms";
import { getPublicScheduleDay, listPublicRooms } from "@/lib/schedule-v2/public-schedule";
import { isPublicDateKey } from "@/lib/schedule-v2/public-schedule-state";

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date");
  const periodNumber = parseFreeRoomPeriodNumber(request.nextUrl.searchParams.get("periodNumber"));

  if (!date || !isPublicDateKey(date)) {
    return NextResponse.json(
      { error: { code: "INVALID_DATE", message: "Дата має формат YYYY-MM-DD." } },
      { status: 400 },
    );
  }
  if (periodNumber === null) {
    return NextResponse.json(
      { error: { code: "INVALID_PERIOD", message: "Оберіть коректний номер пари." } },
      { status: 400 },
    );
  }

  try {
    const [day, allRooms] = await Promise.all([
      getPublicScheduleDay({ date, groupId: null, teacherId: null }),
      listPublicRooms(),
    ]);
    const rooms = availableRoomsForPeriod({ rooms: allRooms, items: day.items, periodNumber });

    return NextResponse.json({
      data: {
        date,
        periodNumber,
        rooms,
        availableCount: rooms.length,
        totalCount: allRooms.length,
      },
    }, {
      headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" },
    });
  } catch (error) {
    console.error("public_free_rooms_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json(
      { error: { code: "FREE_ROOMS_UNAVAILABLE", message: "Не вдалося завантажити вільні аудиторії." } },
      { status: 503 },
    );
  }
}
