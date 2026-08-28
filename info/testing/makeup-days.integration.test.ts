import { expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const cookie = vi.hoisted(() => ({ token: "" }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => cookie.token ? { value: cookie.token } : undefined }) }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { createAuthSession, registerAccount } from "@/lib/auth/repository";
import { listJournalLessons, listJournalStudents, saveAttendance } from "@/lib/attendance/repository";
import { getScheduleDayContext, listMakeupDays, listPublicMakeupDays, saveMakeupDay, deleteMakeupDay } from "@/lib/schedule-calendar/repository";
import { listScheduleForDate } from "@/lib/schedule-calendar/schedule";
import { saveScheduleWeekSettings } from "@/lib/schedule-week/repository";
import { importTeacherSchedule } from "@/lib/schedule-import/repository";
import { importTeacherStudents } from "@/lib/students/import-repository";
import { listTeacherStudents } from "@/lib/students/repository";
import { endSemester } from "@/lib/semesters/repository";
import { saveMakeupDayAction, deleteMakeupDayAction } from "@/app/(private)/dashboard/(admin)/settings/makeup-actions";
import { initialMakeupActionState } from "@/app/(private)/dashboard/(admin)/settings/makeup-form-state";
import { saveAttendanceAction } from "@/app/(private)/dashboard/journal/actions";
import { initialJournalState } from "@/app/(private)/dashboard/journal/form-state";

const makeupInput = (date: string, version = "0", dayOfWeek = "1", weekType = "numerator") => ({ date, version, dayOfWeek, weekType });
function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

it.skipIf(!process.env.VIDMITKA_ATTENDANCE_TEST_SCHEMA)(
  "відпрацювання: права → календар → фактичний розклад → захищений журнал → архів",
  async () => {
    const sql = getDb();
    const [scope] = await sql`SELECT current_schema() AS name` as unknown as { name: string }[];
    expect(scope.name).toBe(process.env.VIDMITKA_ATTENDANCE_TEST_SCHEMA);
    expect(scope.name).toMatch(/^codex_attendance_test_[0-9a-f]{16}$/u);
    const administratorToken = (await createAuthSession("administrator")).token;
    const teacherToken = (await createAuthSession("teacher")).token;
    const pending = await registerAccount({ fullName: "Тест Календаря", email: "codex.attendance.pending-calendar@example.test", password: "Codex Attendance Test 2026!", administratorCode: "" });
    if (!pending.success) throw new Error("Pending fixture account was not created");
    expect(pending.user.approval).toBe("pending");
    const pendingToken = (await createAuthSession(pending.user.id)).token;
    for (const [token, destination] of [["", "/sign-in"], [teacherToken, "/dashboard?access=denied"], [pendingToken, "/approval-pending"]]) {
      cookie.token = token;
      await expect(saveMakeupDayAction(initialMakeupActionState, form(makeupInput("2026-09-04"))))
        .rejects.toThrow(`redirect:${destination}`);
      await expect(deleteMakeupDayAction(initialMakeupActionState, form({ date: "2026-09-04", version: "1" })))
        .rejects.toThrow(`redirect:${destination}`);
    }
    expect((await saveMakeupDay("teacher", makeupInput("2026-09-04"))).success).toBe(false);
    expect(await listMakeupDays()).toEqual([]);
    expect(await listPublicMakeupDays()).toEqual([]);

    const baseLesson = { subjectName: "Основи програмування", roomName: "101" };
    expect((await importTeacherSchedule("teacher", [
      { ...baseLesson, rowNumber: 1, periodNumber: 1, dayOfWeek: 1, weekType: "numerator" },
      { ...baseLesson, rowNumber: 2, periodNumber: 2, dayOfWeek: 1, weekType: "denominator" },
      { ...baseLesson, rowNumber: 3, periodNumber: 3, dayOfWeek: 1, weekType: "both" },
      { ...baseLesson, rowNumber: 4, periodNumber: 4, dayOfWeek: 5, weekType: "both" },
    ])).success).toBe(true);

    const regular = await getScheduleDayContext("2026-09-04");
    expect(regular).toMatchObject({ dayOfWeek: 5, weekType: null, isMakeup: false });
    // Without an anchor, the automatic view still includes only weekly lessons.
    expect((await listScheduleForDate("2026-08-31")).lessons.map((lesson) => lesson.periodNumber)).toEqual([3]);
    const unconfiguredPreview = await listScheduleForDate("2026-08-31", "numerator");
    expect(unconfiguredPreview.lessons.map((lesson) => lesson.periodNumber)).toEqual([1, 3]);
    expect(unconfiguredPreview.view).toMatchObject({ weekType: "numerator", isPreview: true });
    expect(unconfiguredPreview.day.weekType).toBeNull();
    expect((await listScheduleForDate("2026-08-31", "both")).lessons.map((lesson) => lesson.periodNumber)).toEqual([3]);
    cookie.token = administratorToken;
    expect((await saveMakeupDayAction(initialMakeupActionState, form(makeupInput("2026-09-04")))).success).toBe(true);
    expect(revalidatePath).toHaveBeenCalledWith("/transfers");
    cookie.token = "";
    expect(await listPublicMakeupDays()).toEqual([
      { date: "2026-09-04", dayOfWeek: 1, weekType: "numerator" },
    ]);
    cookie.token = administratorToken;
    const first = await getScheduleDayContext("2026-09-04");
    expect(first).toMatchObject({ date: "2026-09-04", calendarDayOfWeek: 5, dayOfWeek: 1, weekType: "numerator", isMakeup: true });
    expect((await listScheduleForDate("2026-09-04")).lessons.map((lesson) => lesson.periodNumber)).toEqual([1, 3]);
    const makeupPreview = await listScheduleForDate("2026-09-04", "denominator");
    expect(makeupPreview.lessons.map((lesson) => lesson.periodNumber)).toEqual([2, 3]);
    expect(makeupPreview.view).toMatchObject({ weekType: "denominator", isPreview: true });
    expect(makeupPreview.day).toEqual(first);
    expect(await getScheduleDayContext("2026-09-04")).toEqual(first);
    expect((await listJournalLessons("teacher", "2026-09-04")).lessons.map((lesson) => lesson.periodNumber)).toEqual([1, 3]);
    expect((await listJournalLessons("other-teacher", "2026-09-04")).lessons).toEqual([]);
    expect((await saveMakeupDay("administrator", makeupInput("2026-09-04"))).success).toBe(false);

    let entry = (await listMakeupDays())[0];
    expect(entry.hasJournal).toBe(false);
    expect((await saveMakeupDay("administrator", makeupInput(entry.date, String(entry.version), "2", "denominator"))).success).toBe(true);
    expect((await saveMakeupDay("administrator", makeupInput(entry.date, String(entry.version)))).success).toBe(false);
    expect((await deleteMakeupDay("administrator", { date: entry.date, version: String(entry.version) })).success).toBe(false);
    entry = (await listMakeupDays())[0];
    expect(await getScheduleDayContext(entry.date)).toMatchObject({ dayOfWeek: 2, weekType: "denominator", isMakeup: true });
    expect(await listPublicMakeupDays()).toEqual([
      { date: "2026-09-04", dayOfWeek: 2, weekType: "denominator" },
    ]);
    vi.mocked(revalidatePath).mockClear();
    expect((await deleteMakeupDayAction(initialMakeupActionState, form({ date: entry.date, version: String(entry.version) }))).success).toBe(true);
    expect(revalidatePath).toHaveBeenCalledWith("/transfers");
    expect(await listPublicMakeupDays()).toEqual([]);
    expect(await listMakeupDays()).toEqual([]);
    expect(await getScheduleDayContext(entry.date)).toMatchObject({ dayOfWeek: 5, weekType: null, isMakeup: false });
    expect((await saveMakeupDay("administrator", makeupInput(entry.date))).success).toBe(true);
    expect((await getScheduleDayContext(entry.date)).token).not.toBe(first.token);
    entry = (await listMakeupDays())[0];
    await deleteMakeupDay("administrator", { date: entry.date, version: String(entry.version) });

    expect((await saveScheduleWeekSettings({ numeratorDate: "2026-08-24" })).success).toBe(true);
    expect(await getScheduleDayContext("2026-08-31")).toMatchObject({ dayOfWeek: 1, weekType: "denominator", isMakeup: false });
    expect((await listScheduleForDate("2026-08-31", "numerator")).lessons.map((lesson) => lesson.periodNumber)).toEqual([1, 3]);
    const calendarView = await listScheduleForDate("2026-08-31");
    expect(calendarView.lessons.map((lesson) => lesson.periodNumber)).toEqual([2, 3]);
    expect(calendarView.view).toMatchObject({ weekType: "denominator", isPreview: false });
    const date = "2026-08-21";
    expect((await saveMakeupDay("administrator", makeupInput(date))).success).toBe(true);
    const before = await listJournalLessons("teacher", date);
    const bothLesson = before.lessons.find((lesson) => lesson.periodNumber === 3)!;
    expect((await importTeacherStudents("teacher", { lessonId: bothLesson.lessonId! }, [
      { fullName: "Тестенко Анна", groupName: "КН-41", subgroup: "1" },
      { fullName: "Тестенко Богдан", groupName: "КН-41", subgroup: "2" },
    ])).success).toBe(true);
    const students = await listJournalStudents("teacher", bothLesson);
    const marks = students.map((student) => ({ studentId: student.studentId, status: student.subgroup === "1" ? "present" : "not_required" }));
    const staleInput = { date, key: bothLesson.key, version: 0, calendarToken: before.day!.token, marks };
    const previous = (await listMakeupDays()).find((day) => day.date === date)!;
    expect((await saveMakeupDay("administrator", makeupInput(date, String(previous.version), "1", "denominator"))).success).toBe(true);
    expect((await saveAttendance("teacher", staleInput)).success).toBe(false);
    const current = await listJournalLessons("teacher", date);
    expect(current.lessons.map((lesson) => lesson.periodNumber)).toEqual([2, 3]);
    cookie.token = teacherToken;
    const attendanceData = form({ date, lessonKey: bothLesson.key, version: "0", marks: JSON.stringify(marks) });
    expect((await saveAttendanceAction(initialJournalState, attendanceData)).success).toBe(false);
    attendanceData.set("calendarToken", current.day!.token);
    expect((await saveAttendanceAction(initialJournalState, attendanceData)).success).toBe(true);
    const saved = (await listJournalLessons("teacher", date)).lessons.find((lesson) => lesson.key === bothLesson.key)!;
    expect(saved.version).toBe(1);
    expect((await listJournalStudents("teacher", saved)).map((student) => student.status)).toEqual(["present", "not_required"]);
    const protectedDay = (await listMakeupDays()).find((day) => day.date === date)!;
    expect(protectedDay.hasJournal).toBe(true);
    // Public output contains no journal flags or audit fields and stays chronological.
    expect((await saveMakeupDay("administrator", makeupInput("2026-10-09", "0", "2", "denominator"))).success).toBe(true);
    expect((await saveMakeupDay("administrator", makeupInput("2026-09-11"))).success).toBe(true);
    expect(await listPublicMakeupDays()).toEqual([
      { date: "2026-08-21", dayOfWeek: 1, weekType: "denominator" },
      { date: "2026-09-11", dayOfWeek: 1, weekType: "numerator" },
      { date: "2026-10-09", dayOfWeek: 2, weekType: "denominator" },
    ]);
    expect((await saveMakeupDay("administrator", makeupInput(date, String(protectedDay.version), "5"))).success).toBe(false);
    expect((await deleteMakeupDay("administrator", { date, version: String(protectedDay.version) })).success).toBe(false);
    expect((await getScheduleDayContext("2026-08-31")).weekType).toBe("denominator");

    // Перший запис журналу і підміна розкладу конкурують за одну календарну дату.
    const raceDate = "2026-08-14";
    const race = await listJournalLessons("teacher", raceDate);
    const friday = race.lessons[0];
    const raceMarks = (await listJournalStudents("teacher", friday)).map((student) => ({ studentId: student.studentId, status: "present" }));
    const outcomes = await Promise.all([
      saveMakeupDay("administrator", makeupInput(raceDate)),
      saveAttendance("teacher", { date: raceDate, key: friday.key, version: 0, calendarToken: race.day!.token, marks: raceMarks }),
    ]);
    expect(outcomes.filter((outcome) => outcome.success)).toHaveLength(1);
    const afterRace = await listJournalLessons("teacher", raceDate);
    expect(afterRace.day!.isMakeup).toBe(outcomes[0].success);
    if (outcomes[1].success) {
      expect(afterRace.lessons[0].version).toBe(1);
      expect((await saveMakeupDay("administrator", makeupInput(raceDate))).success).toBe(false);
    }

    const studentIds = (await listTeacherStudents("teacher")).map((student) => student.studentId);
    expect((await endSemester("administrator")).success).toBe(true);
    const archive = await listJournalLessons("teacher", date);
    expect(archive.day!.isMakeup).toBe(true);
    expect(archive.lessons).toHaveLength(1);
    expect(archive.lessons[0].archived).toBe(true);
    expect((await listJournalStudents("teacher", archive.lessons[0])).map((student) => student.status)).toEqual(["present", "not_required"]);
    expect((await listScheduleForDate(date)).lessons).toEqual([]);
    expect((await listTeacherStudents("teacher")).map((student) => student.studentId)).toEqual(studentIds);
    expect((await deleteMakeupDay("administrator", { date, version: String(protectedDay.version) })).success).toBe(false);
  },
  120000,
);
