import { describe, expect, it } from "vitest";
import { attendanceSummary, applyAudience, isJournalDate, suggestedLessonId, type AttendanceStudent } from "./rules";

const rows: AttendanceStudent[] = [
  { studentId: "1", fullName: "Анна", groupName: "КН-21", subgroup: "1", status: "present" },
  { studentId: "2", fullName: "Богдан", groupName: "КН-21", subgroup: "2", status: "absent" },
  { studentId: "3", fullName: "Марія", groupName: "КН-22", subgroup: "1", status: "unmarked" },
];
describe("відвідування", () => {
  it("виключає непотрібні відмітки, а незаповнені не вважає пропусками", () => {
    expect(attendanceSummary([...rows, { ...rows[0], studentId: "4", status: "not_required" }])).toEqual({
      total: 4, expected: 3, present: 1, absent: 1, unmarked: 1, notRequired: 1, percentage: 33,
    });
  });
  it("не ділить на нуль, якщо всі виключені", () => {
    expect(attendanceSummary([{ ...rows[0], status: "not_required" }]).percentage).toBe(null);
  });
  it("застосовує і групу, і підгрупу без втрати відмітки учасника", () => {
    const selected = applyAudience(rows, "КН-21", "1");
    expect(selected.map((row) => row.status)).toEqual(["present", "not_required", "not_required"]);
    expect(applyAudience(selected, "", "").map((row) => row.status)).toEqual(["present", "unmarked", "unmarked"]);
  });
  it.each(["2026-02-30", "2026-2-01", "0000-01-01", "bad"])("відхиляє дату %s", (value) => {
    expect(isJournalDate(value)).toBe(false);
  });
  it("приймає високосну дату", () => expect(isJournalDate("2024-02-29")).toBe(true));
  it("пропонує поточну пару, потім наступну або першу", () => {
    const lessons = [{ key: "lesson:1", startMinute: 480, endMinute: 560 }, { key: "lesson:2", startMinute: 575, endMinute: 655 }];
    expect(suggestedLessonId(lessons, 500)).toBe("lesson:1");
    expect(suggestedLessonId(lessons, 565)).toBe("lesson:2");
    expect(suggestedLessonId(lessons, 700)).toBe("lesson:1");
  });
});
