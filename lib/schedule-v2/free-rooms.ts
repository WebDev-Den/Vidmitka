export type PublicRoom = Readonly<{ id: string; name: string }>;

type RoomOccupancyItem = Readonly<{
  periodNumber: number;
  rooms: readonly string[];
  cancelled: boolean;
}>;

function roomKey(value: string): string {
  return value.normalize("NFC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("uk-UA");
}

export function parseFreeRoomPeriodNumber(value: string | null): number | null {
  if (!value || !/^\d{1,2}$/u.test(value)) return null;
  const periodNumber = Number(value);
  return Number.isInteger(periodNumber) && periodNumber >= 1 && periodNumber <= 99 ? periodNumber : null;
}

export function availableRoomsForPeriod(input: Readonly<{
  rooms: readonly PublicRoom[];
  items: readonly RoomOccupancyItem[];
  periodNumber: number;
}>): PublicRoom[] {
  const occupiedRooms = new Set(
    input.items
      .filter((item) => item.periodNumber === input.periodNumber && !item.cancelled)
      .flatMap((item) => item.rooms)
      .map(roomKey),
  );

  return input.rooms.filter((room) => !occupiedRooms.has(roomKey(room.name)));
}
