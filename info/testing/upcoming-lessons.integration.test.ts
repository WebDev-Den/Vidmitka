import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const cookie = vi.hoisted(() => ({ token: "" }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => cookie.token ? { value: cookie.token } : undefined }) }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import { getDb } from "@/lib/db";
import { createAuthSession, registerAccount } from "@/lib/auth/repository";
import { listLessonTypes, saveLessonType, setLessonTypeActive } from "@/lib/lesson-types/repository";
import { parseScheduleImport } from "@/lib/schedule-import/parser";
import { importTeacherSchedule } from "@/lib/schedule-import/repository";
import { createLesson } from "@/lib/lessons/create";
import { listTeacherLessons, setLessonTypeForLesson } from "@/lib/lessons/repository";
import { listRooms } from "@/lib/rooms/repository";
import { listSubjects } from "@/lib/subjects/repository";
import { listClassPeriods } from "@/lib/class-periods/repository";
import { listGroupStudents } from "@/lib/groups/repository";
import { listUpcomingLessons } from "@/lib/schedule-calendar/upcoming";
import { listScheduleForDate } from "@/lib/schedule-calendar/schedule";
import { saveMakeupDay, deleteMakeupDay, listMakeupDays } from "@/lib/schedule-calendar/repository";
import { saveScheduleWeekSettings } from "@/lib/schedule-week/repository";
import { importTeacherStudents } from "@/lib/students/import-repository";
import { listJournalLessons, listJournalStudents, saveAttendance } from "@/lib/attendance/repository";
import { endSemester } from "@/lib/semesters/repository";
import { saveLessonTypeAction, toggleLessonTypeAction } from "@/app/(private)/dashboard/(admin)/lesson-types/actions";
import { initialLessonTypeState } from "@/app/(private)/dashboard/(admin)/lesson-types/form-state";
import { updateLessonTypeAction } from "@/app/(private)/dashboard/my-lessons/actions";
import { initialLessonState } from "@/app/(private)/dashboard/lessons/new/form-state";

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}
async function importLessons(rows: Record<string, unknown>[], teacher = "teacher") {
  const parsed = parseScheduleImport({ fileName: "schedule.json", content: JSON.stringify(rows) });
  if (!parsed.ok) throw new Error(parsed.errors.join("; "));
  return importTeacherSchedule(teacher, parsed.rows);
}

it.skipIf(!process.env.VIDMITKA_ATTENDANCE_TEST_SCHEMA)("типи занять → п’ять найближчих проведень → незмінний журнал", async () => {
  const [scope] = await getDb()`SELECT current_schema() AS name` as unknown as { name: string }[];
  expect(scope.name).toBe(process.env.VIDMITKA_ATTENDANCE_TEST_SCHEMA);
  expect(scope.name).toMatch(/^codex_attendance_test_[0-9a-f]{16}$/u);
  const now = new Date("2026-08-24T05:30:00Z"); // Понеділок, 08:30 у Києві.
  expect(await listUpcomingLessons(now)).toEqual([]);
  const initialTypes = await listLessonTypes();
  expect(initialTypes.map((type) => type.name)).toEqual(expect.arrayContaining(["Лекція", "Практична", "Лабораторна"]));
  const lecture = initialTypes.find((type) => type.name === "Лекція")!;
  const administratorToken = (await createAuthSession("administrator")).token;
  const teacherToken = (await createAuthSession("teacher")).token;
  const pending = await registerAccount({ fullName: "Тест Типів", email: "codex.attendance.pending-types@example.test", password: "Codex Attendance Test 2026!", administratorCode: "" });
  if (!pending.success) throw new Error("Pending fixture account was not created");
  const pendingToken = (await createAuthSession(pending.user.id)).token;
  for (const [token, destination] of [["", "/sign-in"], [teacherToken, "/dashboard?access=denied"], [pendingToken, "/approval-pending"]]) {
    cookie.token = token;
    await expect(saveLessonTypeAction(initialLessonTypeState, form({ name: "Семінар" }))).rejects.toThrow(`redirect:${destination}`);
    await expect(toggleLessonTypeAction(initialLessonTypeState, form({ id: lecture.id, active: "false" }))).rejects.toThrow(`redirect:${destination}`);
    if (token !== teacherToken) {
      await expect(updateLessonTypeAction(initialLessonState, form({ lessonId: "1", lessonTypeId: lecture.id }))).rejects.toThrow(`redirect:${destination}`);
    }
  }
  expect((await saveLessonType("teacher", { name: "Семінар" })).success).toBe(false);
  cookie.token = administratorToken;
  expect((await saveLessonTypeAction(initialLessonTypeState, form({ name: "  Семінар  " }))).success).toBe(true);
  const seminar = (await listLessonTypes()).find((type) => type.name === "Семінар")!;
  expect((await saveLessonType("administrator", { name: "семінар" })).success).toBe(false);
  expect((await saveLessonType("administrator", { id: seminar.id, name: "Лекція" })).success).toBe(false);

  const base = { subject: "Основи програмування", room: "101", day: 1 };
  expect((await importLessons([
    { ...base, period: 1, weekType: "numerator", lessonType: "Лекція" },
    { ...base, period: 2, weekType: "denominator", lessonType: "Практична" },
  ])).success).toBe(true);
  // Без опорної дати регулярні однотижневі заняття не вигадуються.
  expect(await listUpcomingLessons(now)).toEqual([]);
  expect((await saveMakeupDay("administrator", { date: "2030-01-04", dayOfWeek: "1", weekType: "denominator", version: "0" })).success).toBe(true);
  expect(await listUpcomingLessons(now)).toMatchObject([{ date: "2030-01-04", periodNumber: 2, lessonTypeName: "Практична", isMakeup: true }]);
  const distant = (await listMakeupDays())[0];
  expect((await deleteMakeupDay("administrator", { date: distant.date, version: String(distant.version) })).success).toBe(true);
  expect((await importLessons([
    { ...base, period: 3, weekType: "both", lessonType: "Семінар" },
    { ...base, day: 5, period: 1, weekType: "both", lessonType: "Лабораторна" },
  ])).success).toBe(true);
  expect((await importLessons([{ ...base, room: "102", period: 1, weekType: "numerator", lessonType: "Лекція" }], "other-teacher")).success).toBe(true);
  expect((await listUpcomingLessons(now))[0]).toMatchObject({ date: "2026-08-24", periodNumber: 3, lessonTypeName: "Семінар" });
  expect((await saveScheduleWeekSettings({ numeratorDate: "2026-08-24" })).success).toBe(true);
  const upcoming = await listUpcomingLessons(now);
  expect(upcoming.map((lesson) => [lesson.date, lesson.periodNumber, lesson.teacherName])).toEqual([
    ["2026-08-24", 1, "Тест other-teacher"], ["2026-08-24", 1, "Тест teacher"],
    ["2026-08-24", 3, "Тест teacher"], ["2026-08-28", 1, "Тест teacher"], ["2026-08-31", 2, "Тест teacher"],
  ]);
  expect(upcoming[1]).toMatchObject({ subjectName: "Основи програмування", roomName: "101", lessonTypeName: "Лекція", startMinute: 480, endMinute: 560, isCurrent: true });
  expect(upcoming[2].isCurrent).toBe(false);
  expect((await listUpcomingLessons(new Date("2026-08-24T06:20:00Z")))[0].periodNumber).toBe(3); // Рівно 09:20: перша пара закінчилася.
  expect((await listUpcomingLessons(new Date("2026-08-23T21:30:00Z")))[0].date).toBe("2026-08-24"); // Вже понеділок у Києві.
  expect((await listUpcomingLessons(new Date("2026-08-24T20:00:00Z")))[0].date).toBe("2026-08-28");

  expect((await saveMakeupDay("administrator", { date: "2026-09-04", dayOfWeek: "1", weekType: "denominator", version: "0" })).success).toBe(true);
  const makeup = await listUpcomingLessons(new Date("2026-09-03T21:00:00Z"));
  expect(makeup.map((lesson) => [lesson.date, lesson.periodNumber])).toEqual([
    ["2026-09-04", 2], ["2026-09-04", 3], ["2026-09-07", 1], ["2026-09-07", 1], ["2026-09-07", 3],
  ]);
  expect(makeup[0]).toMatchObject({ isMakeup: true, weekType: "denominator", lessonTypeName: "Практична" });
  const beforeInvalid = await listTeacherLessons("teacher");
  expect((await importLessons([
    { ...base, day: 6, period: 1, weekType: "both", lessonType: "Лекція" },
    { ...base, day: 6, period: 2, weekType: "both", lessonType: "Неіснуючий тип" },
  ])).success).toBe(false);
  expect(await listTeacherLessons("teacher")).toEqual(beforeInvalid);

  const journal = await listJournalLessons("teacher", "2026-08-24");
  const lesson = journal.lessons.find((row) => row.periodNumber === 1)!;
  expect((await importTeacherStudents("teacher", { lessonId: lesson.lessonId! }, [{ fullName: "Тестенко Анна", groupName: "КН-71", subgroup: "1" }])).success).toBe(true);
  const students = await listJournalStudents("teacher", lesson);
  expect((await saveAttendance("teacher", { date: "2026-08-24", key: lesson.key, version: 0, calendarToken: journal.day!.token,
    marks: students.map((student) => ({ studentId: student.studentId, status: "present" })) })).success).toBe(true);
  expect((await saveLessonTypeAction(initialLessonTypeState, form({ id: lecture.id, name: "Оглядова лекція" }))).success).toBe(true);
  expect((await listScheduleForDate("2026-08-24")).lessons.find((row) => row.id === lesson.lessonId)?.lessonTypeName).toBe("Оглядова лекція");
  expect((await listJournalLessons("teacher", "2026-08-24")).lessons.find((row) => row.key === lesson.key)?.lessonTypeName).toBe("Лекція");
  expect((await toggleLessonTypeAction(initialLessonTypeState, form({ id: lecture.id, active: "false" }))).success).toBe(true);
  expect((await listLessonTypes({ activeOnly: true })).some((type) => type.id === lecture.id)).toBe(false);
  expect((await listUpcomingLessons(now))[0].lessonTypeName).toBe("Оглядова лекція"); // Деактивація не приховує старе заняття.
  expect((await importLessons([{ ...base, day: 6, period: 1, weekType: "both", lessonType: "Оглядова лекція" }])).success).toBe(false);

  const student = (await listGroupStudents())[0];
  const draft = { subjectId: (await listSubjects())[0].id, roomId: (await listRooms())[0].id,
    classPeriodId: (await listClassPeriods())[0].id, lessonTypeId: lecture.id,
    dayOfWeek: "6", weekType: "both", groupNames: [student.groupName], studentIds: [student.id] };
  expect((await createLesson("teacher", "teacher", draft)).success).toBe(false);
  expect((await createLesson("teacher", "teacher", { ...draft, lessonTypeId: "999999999" })).success).toBe(false);
  expect((await setLessonTypeActive("administrator", lecture.id, true)).success).toBe(true);
  const created = await createLesson("teacher", "teacher", draft);
  expect(created.success).toBe(true);
  expect((await listTeacherLessons("teacher")).find((row) => row.id === created.lessonId)?.lessonTypeName).toBe("Оглядова лекція");
  const assigned = await createLesson("administrator", "teacher", { ...draft, classPeriodId: (await listClassPeriods())[1].id });
  expect(assigned.success).toBe(true);
  expect((await setLessonTypeForLesson("teacher", assigned.lessonId!, seminar.id)).success).toBe(false);
  expect((await setLessonTypeForLesson("administrator", assigned.lessonId!, seminar.id)).success).toBe(true);
  // Старі файли без типу не отримують вигаданого значення.
  expect((await importLessons([{ ...base, day: 7, period: 1, weekType: "both" }])).success).toBe(true);
  expect((await listTeacherLessons("teacher")).find((row) => row.dayOfWeek === 7)?.lessonTypeName).toBeNull();
  expect((await setLessonTypeForLesson("other-teacher", lesson.lessonId!, seminar.id)).success).toBe(false);
  cookie.token = teacherToken;
  expect((await updateLessonTypeAction(initialLessonState, form({ lessonId: lesson.lessonId!, lessonTypeId: seminar.id }))).success).toBe(true);
  expect((await listTeacherLessons("teacher")).find((row) => row.id === lesson.lessonId)?.lessonTypeName).toBe("Семінар");
  expect((await listJournalLessons("teacher", "2026-08-24")).lessons.find((row) => row.key === lesson.key)?.lessonTypeName).toBe("Лекція");
  expect((await endSemester("administrator")).success).toBe(true);
  expect(await listUpcomingLessons(now)).toEqual([]);
  const archive = (await listJournalLessons("teacher", "2026-08-24")).lessons[0];
  expect(archive).toMatchObject({ archived: true, lessonTypeName: "Лекція" });
  expect((await listJournalStudents("teacher", archive))[0].status).toBe("present");
  // Рідкий розклад: п’ять реальних проведень одного запису через два тижні.
  expect((await importLessons([{ ...base, day: 2, period: 1, weekType: "numerator", lessonType: "Оглядова лекція" }])).success).toBe(true);
  expect((await listUpcomingLessons(new Date("2026-08-25T20:00:00Z")))).toMatchObject([
    { date: "2026-09-08" }, { date: "2026-09-22" }, { date: "2026-10-06" }, { date: "2026-10-20" }, { date: "2026-11-03" },
  ]);
}, 180000);
