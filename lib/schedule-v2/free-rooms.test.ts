import { describe, expect, it } from "vitest";

import { availableRoomsForPeriod, parseFreeRoomPeriodNumber } from "./free-rooms";

const rooms = [
  { id: "room-101", name: "1-101" },
  { id: "room-204", name: "1-204" },
  { id: "room-205", name: "1-205" },
] as const;

describe("availableRoomsForPeriod", () => {
  it("повертає активний каталог без аудиторій, зайнятих на вибраній парі", () => {
    expect(availableRoomsForPeriod({
      rooms,
      periodNumber: 2,
      items: [
        { periodNumber: 2, rooms: ["1-204"], cancelled: false },
        { periodNumber: 3, rooms: ["1-205"], cancelled: false },
      ],
    })).toEqual([
      { id: "room-101", name: "1-101" },
      { id: "room-205", name: "1-205" },
    ]);
  });

  it("не блокує аудиторію скасованим заняттям і враховує кілька зайнятих кімнат", () => {
    expect(availableRoomsForPeriod({
      rooms,
      periodNumber: 4,
      items: [
        { periodNumber: 4, rooms: ["1-101", "1-205"], cancelled: false },
        { periodNumber: 4, rooms: ["1-204"], cancelled: true },
      ],
    })).toEqual([{ id: "room-204", name: "1-204" }]);
  });
});

describe("parseFreeRoomPeriodNumber", () => {
  it("приймає лише цілий номер пари від 1 до 99", () => {
    expect(parseFreeRoomPeriodNumber("1")).toBe(1);
    expect(parseFreeRoomPeriodNumber("99")).toBe(99);
    expect(parseFreeRoomPeriodNumber("0")).toBeNull();
    expect(parseFreeRoomPeriodNumber("2.5")).toBeNull();
    expect(parseFreeRoomPeriodNumber("abc")).toBeNull();
    expect(parseFreeRoomPeriodNumber(null)).toBeNull();
  });
});
