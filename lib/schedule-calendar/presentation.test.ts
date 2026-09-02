import { describe, expect, it } from "vitest";
import {
  buildPeriodScheduleColumns, calendarDate, calendarDateKey, formatScheduleDate, groupScheduleLessons,
  scheduleDateHref, shiftScheduleDate,
} from "./presentation";
import type { ScheduledLesson } from "./schedule";

describe("навігація календаря розкладу", () => {
  it.each(["0001-01-01", "0099-12-31", "2026-08-28", "2026-03-29", "2026-10-25", "9999-12-31"])(
    "зберігає календарний ключ %s без зсуву часового поясу", (date) => {
      expect(calendarDate(date).getUTCHours()).toBe(12);
      expect(calendarDateKey(calendarDate(date))).toBe(date);
    },
  );

  it.each([
    ["2026-08-31", 1, "2026-09-01"],
    ["2026-01-01", -1, "2025-12-31"],
    ["2024-02-28", 1, "2024-02-29"],
    ["2026-02-28", 1, "2026-03-01"],
    ["2026-03-29", 1, "2026-03-30"],
    ["2026-10-25", -1, "2026-10-24"],
    ["0099-12-31", 1, "0100-01-01"],
  ] as const)("перехід %s на %s днів → %s", (date, offset, expected) => {
    expect(shiftScheduleDate(date, offset)).toBe(expected);
  });

  it("не створює посилання на день за межами підтриманих років", () => {
    expect(shiftScheduleDate("0001-01-01", -1)).toBeNull();
    expect(shiftScheduleDate("9999-12-31", 1)).toBeNull();
    expect(shiftScheduleDate("2026-02-30", 1)).toBeNull();
    expect(shiftScheduleDate("2026-08-28", 1.5)).toBeNull();
    expect(calendarDateKey(new Date(NaN))).toBeNull();
  });

  it("повертає фактичний календарний розклад без ручного week для обох сторінок", () => {
    expect(scheduleDateHref("/schedule", "2026-08-31")).toBe("/schedule?date=2026-08-31");
    expect(scheduleDateHref("/dashboard/schedule", "2026-08-31")).toBe("/dashboard/schedule?date=2026-08-31");
  });

  it("форматує дату українською", () => {
    expect(formatScheduleDate("2026-08-28")).toContain("28 серпня 2026");
  });
});

const lesson: ScheduledLesson = {
  id: "first", subjectName: "Математика", lessonTypeName: "Лекція", teacherName: "Викладач 1",
  lessonTypeColor: "#0F766E",
  roomName: "101", periodNumber: 2, startMinute: 575, endMinute: 655, weekType: "both", groupNames: ["КН-21"],
};

describe("денний список пар", () => {
  it("залишає всі паралельні заняття й відомості в одній парі", () => {
    const parallel = { ...lesson, id: "parallel", teacherName: "Викладач 2", roomName: "204" };
    const source = Object.freeze([lesson, parallel]);
    const groups = groupScheduleLessons(source);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ number: 2, startMinute: 575, endMinute: 655, lessons: [lesson, parallel] });
    expect(source).toEqual([lesson, parallel]);
  });

  it("сортує пари за часом, не змішуючи однакові номери з різними межами", () => {
    const later = { ...lesson, id: "later", periodNumber: 5, startMinute: 875, endMinute: 955 };
    const anotherTime = { ...lesson, id: "different", startMinute: 670, endMinute: 750 };
    expect(groupScheduleLessons([later, anotherTime, lesson]).map((group) => group.lessons.map((entry) => entry.id)))
      .toEqual([["first"], ["different"], ["later"]]);
  });

  it("не вигадує пари в порожньому дні", () => {
    expect(groupScheduleLessons([])).toEqual([]);
  });
});

describe("головна сітка за номерами пар", () => {
  const periods = [
    { id: "period-3", number: 3, startMinute: 670, endMinute: 750, isActive: true },
    { id: "period-1", number: 1, startMinute: 480, endMinute: 560, isActive: true },
    { id: "period-2", number: 2, startMinute: 575, endMinute: 655, isActive: false },
  ] as const;

  it("показує кожну активну пару в часовому порядку, включно з порожньою", () => {
    const source = Object.freeze([...periods]);
    const columns = buildPeriodScheduleColumns(source, [lesson]);

    expect(columns.map(({ period, lessons }) => ({ number: period.number, lessonIds: lessons.map(({ id }) => id) })))
      .toEqual([
        { number: 1, lessonIds: [] },
        { number: 3, lessonIds: [] },
      ]);
    expect(source).toEqual(periods);
  });

  it("не губить паралельні заняття й не створює колонки для неактивного слота", () => {
    const parallel = { ...lesson, id: "parallel", teacherName: "Викладач 2" };
    const columns = buildPeriodScheduleColumns([
      { ...periods[1], isActive: true },
      { ...periods[2], isActive: true },
    ], [parallel, lesson]);

    expect(columns).toHaveLength(2);
    expect(columns[0].lessons).toEqual([]);
    expect(columns[1].lessons.map(({ id }) => id)).toEqual(["parallel", "first"]);
  });
});
