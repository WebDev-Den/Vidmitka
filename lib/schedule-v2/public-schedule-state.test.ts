import { describe, expect, it } from "vitest";

import {
  addPublicScheduleDays,
  isPublicDateKey,
  isPublicUuid,
  normalizePublicTeacherPreference,
  publicNavigationWeek,
  publicScheduleScrollTarget,
  publicScheduleRequestUrl,
} from "./public-schedule-state";

const teacherId = "6f87807e-2113-439c-b414-31d51c970076";

describe("public schedule view state", () => {
  it("builds a Monday-to-Sunday navigation week around the selected date", () => {
    expect(publicNavigationWeek("2026-09-04").map((item) => item.date)).toEqual([
      "2026-08-31", "2026-09-01", "2026-09-02", "2026-09-03",
      "2026-09-04", "2026-09-05", "2026-09-06",
    ]);
    expect(addPublicScheduleDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("accepts only real date keys and supported UUID values", () => {
    expect(isPublicDateKey("2026-09-04")).toBe(true);
    expect(isPublicDateKey("2026-02-30")).toBe(false);
    expect(isPublicUuid(teacherId)).toBe(true);
    expect(isPublicUuid("not-a-teacher")).toBe(false);
  });

  it("restores only an active teacher from the cookie preference", () => {
    const teachers = [{ id: teacherId }, { id: "0ae3afbd-8c44-4c89-8541-4e7205c5f65e" }];
    expect(normalizePublicTeacherPreference(teacherId, teachers)).toBe(teacherId);
    expect(normalizePublicTeacherPreference("4b9812b9-6600-4f88-9f70-17ce3bb55751", teachers)).toBe("");
    expect(normalizePublicTeacherPreference("invalid", teachers)).toBe("");
  });

  it("builds a read-only day request without changing the page URL", () => {
    expect(publicScheduleRequestUrl({ date: "2026-09-04", teacherId })).toBe(
      `/api/public/schedule?date=2026-09-04&teacherId=${teacherId}`,
    );
    expect(publicScheduleRequestUrl({ date: "2026-09-04", teacherId: "" })).toBe(
      "/api/public/schedule?date=2026-09-04",
    );
  });

  it("chooses one initial scroll target only for today's schedule", () => {
    const periods = [
      { number: 1, startTime: "08:00", endTime: "09:20" },
      { number: 2, startTime: "09:35", endTime: "10:55" },
      { number: 3, startTime: "11:10", endTime: "12:30" },
      { number: 4, startTime: "13:00", endTime: "14:20" },
    ];

    expect(publicScheduleScrollTarget({ periods, date: "2026-09-04", currentDate: "2026-09-04", currentMinutes: 12 * 60 })).toBe(3);
    expect(publicScheduleScrollTarget({ periods, date: "2026-09-04", currentDate: "2026-09-04", currentMinutes: 12 * 60 + 34 })).toBe(4);
    expect(publicScheduleScrollTarget({ periods, date: "2026-09-04", currentDate: "2026-09-04", currentMinutes: 21 * 60 })).toBe(4);
    expect(publicScheduleScrollTarget({ periods, date: "2026-09-05", currentDate: "2026-09-04", currentMinutes: 12 * 60 })).toBeNull();
    expect(publicScheduleScrollTarget({ periods: [], date: "2026-09-04", currentDate: "2026-09-04", currentMinutes: 12 * 60 })).toBeNull();
  });
});
