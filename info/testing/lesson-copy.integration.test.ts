import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { getDb } from "@/lib/db";
import { getLessonCopySource } from "@/lib/lessons/copy";
import { prepareLessonCopy, type LessonFormDefaults } from "@/lib/lessons/copy-draft";
import { createLesson } from "@/lib/lessons/create";
import { addLessonStudents, getEditableLessonRoster } from "@/lib/lessons/roster";
import { listTeacherLessons } from "@/lib/lessons/repository";
import { listLessonTypes } from "@/lib/lesson-types/repository";
import { listClassPeriods } from "@/lib/class-periods/repository";
import { listSubjects } from "@/lib/subjects/repository";
import { listRooms } from "@/lib/rooms/repository";
import { addStudentToTeacherSubject } from "@/lib/students/repository";
import { listGroupStudents } from "@/lib/groups/repository";
import { listJournalLessons, listJournalStudents, saveAttendance } from "@/lib/attendance/repository";
import { getDateKeyInTimeZone } from "@/lib/schedule-week/rules";

it.skipIf(!process.env.VIDMITKA_ATTENDANCE_TEST_SCHEMA)("копіювання → нова пара → незалежний список і відвідуваність", async () => {
  const sql = getDb();
  const [scope] = await sql`SELECT current_schema() AS name` as unknown as { name: string }[];
  expect(scope.name).toBe(process.env.VIDMITKA_ATTENDANCE_TEST_SCHEMA);
  expect(scope.name).toMatch(/^codex_attendance_test_[0-9a-f]{16}$/u);
  const date = getDateKeyInTimeZone(new Date());
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay() || 7;
  await sql`INSERT INTO schedule_week_settings (id, anchor_date, anchor_week_type) VALUES (1, ${date}::DATE, 'numerator')`;
  const [periods, subjects, rooms, lessonTypes] = await Promise.all([
    listClassPeriods({ activeOnly: true }), listSubjects({ activeOnly: true }), listRooms({ activeOnly: true }), listLessonTypes({ activeOnly: true }),
  ]);
  const subject = subjects.find((item) => item.name === "Основи програмування")!;
  const room = rooms.find((item) => item.name === "101")!;
  const studentInput = { teacherUserId: "teacher", fullName: "Ковальчук Анна", groupMode: "new", existingGroupName: null, newGroupName: "КН-21", subjectId: subject.id, subgroup: "1" };
  expect((await addStudentToTeacherSubject(studentInput)).success).toBe(true);
  expect((await addStudentToTeacherSubject({ ...studentInput, fullName: "Мельник Богдан" })).success).toBe(true);
  const students = await listGroupStudents();
  const anna = students.find((student) => student.fullName === studentInput.fullName)!;
  const bohdan = students.find((student) => student.fullName === "Мельник Богдан")!;
  const draft = { subjectId: subject.id, roomId: room.id, classPeriodId: periods[0].id, lessonTypeId: lessonTypes[0].id,
    dayOfWeek: String(weekday), weekType: "both", groupNames: [anna.groupName], studentIds: [anna.id] };
  const original = await createLesson("teacher", "teacher", draft);
  expect(original.success).toBe(true);
  const originalId = original.lessonId!;
  const findJournal = async (id: string) => (await listJournalLessons("teacher", date)).lessons.find((lesson) => lesson.lessonId === id)!;
  expect((await saveAttendance("teacher", { date, key: (await findJournal(originalId)).key, version: 0,
    calendarToken: (await listJournalLessons("teacher", date)).day!.token, marks: [{ studentId: anna.id, status: "present" }] })).success).toBe(true);

  const source = (await getLessonCopySource("teacher", originalId))!;
  expect(source).toMatchObject({ id: originalId, teacherId: "teacher", subjectId: subject.id, roomId: room.id,
    classPeriodId: periods[0].id, lessonTypeId: lessonTypes[0].id, dayOfWeek: weekday, weekType: "both", rosterMode: "selected", studentIds: [anna.id] });
  expect(await getLessonCopySource("administrator", originalId)).toEqual(source);
  expect(await getLessonCopySource("other-teacher", originalId)).toBeNull();
  expect(await getLessonCopySource("unknown", originalId)).toBeNull();
  for (const invalid of ["0", "-1", "abc", "1 OR 1=1", "9999999999999999999", "999999999"]) {
    expect(await getLessonCopySource("teacher", invalid)).toBeNull();
  }
  await sql`UPDATE app_users SET approval_status = 'pending' WHERE id = 'teacher'`;
  expect(await getLessonCopySource("teacher", originalId)).toBeNull();
  await sql`UPDATE app_users SET approval_status = 'approved' WHERE id = 'teacher'`;
  expect(await listTeacherLessons("teacher")).toHaveLength(1); // Opening/reading creates nothing.

  const available = { periods, subjects, rooms, lessonTypes, students, teachers: [{ id: "teacher" }] };
  const prepared = prepareLessonCopy(source, available);
  const toInput = (values: LessonFormDefaults) => ({ ...values, dayOfWeek: String(values.dayOfWeek),
    groupNames: [...new Set(students.filter((student) => values.studentIds.includes(student.id)).map((student) => student.groupName))],
  });
  expect((await createLesson("teacher", "teacher", toInput(prepared.defaults))).success).toBe(false);
  expect(await listTeacherLessons("teacher")).toHaveLength(1);
  expect((await createLesson("teacher", "other-teacher", { ...toInput(prepared.defaults), classPeriodId: periods[1].id })).success).toBe(false);
  const copied = await createLesson("teacher", "teacher", { ...toInput(prepared.defaults), classPeriodId: periods[1].id });
  expect(copied.success).toBe(true);
  expect(copied.lessonId).not.toBe(originalId);
  expect(await listTeacherLessons("teacher")).toHaveLength(2);
  expect((await getLessonCopySource("teacher", copied.lessonId!))?.classPeriodId).toBe(periods[1].id);
  expect(await getLessonCopySource("teacher", originalId)).toEqual(source);
  expect(await listJournalStudents("teacher", await findJournal(copied.lessonId!))).toEqual([
    expect.objectContaining({ studentId: anna.id, status: "unmarked" }),
  ]);
  expect((await addLessonStudents("teacher", copied.lessonId!, { groupNames: [bohdan.groupName], studentIds: [bohdan.id] })).success).toBe(true);
  expect((await getEditableLessonRoster("teacher", copied.lessonId!))?.studentIds).toHaveLength(2);
  expect((await getEditableLessonRoster("teacher", originalId))?.studentIds).toEqual([anna.id]);
  expect(await listJournalStudents("teacher", await findJournal(originalId))).toEqual([
    expect.objectContaining({ studentId: anna.id, status: "present" }),
  ]);

  const assigned = await createLesson("administrator", "other-teacher", { ...draft, classPeriodId: periods[2].id, studentIds: [], groupNames: [] });
  expect(assigned.success).toBe(true);
  const emptySource = (await getLessonCopySource("other-teacher", assigned.lessonId!))!;
  expect(emptySource.studentIds).toEqual([]); // The owner can copy an administrator-assigned lesson.
  const emptyCopy = await createLesson("other-teacher", "other-teacher", { ...draft, classPeriodId: periods[3].id, studentIds: emptySource.studentIds, groupNames: [] });
  expect(emptyCopy.success).toBe(true);
  expect((await getEditableLessonRoster("other-teacher", emptyCopy.lessonId!))?.studentIds).toEqual([]);
  // Different teacher but same room/time must still conflict.
  expect((await createLesson("teacher", "teacher", { ...draft, classPeriodId: periods[2].id })).success).toBe(false);

  // Legacy subject rosters become a snapshot with an independent selected roster.
  await sql`UPDATE lessons SET roster_mode = 'subject' WHERE id = ${originalId}::BIGINT`;
  const legacy = (await getLessonCopySource("teacher", originalId))!;
  expect(legacy.rosterMode).toBe("subject");
  expect(legacy.studentIds).toEqual(expect.arrayContaining([anna.id, bohdan.id]));
  const legacyCopy = await createLesson("teacher", "teacher", { ...toInput(prepareLessonCopy(legacy, available).defaults), dayOfWeek: String(weekday % 7 + 1) });
  expect(legacyCopy.success).toBe(true);
  expect((await getLessonCopySource("teacher", legacyCopy.lessonId!))?.rosterMode).toBe("selected");

  await sql`UPDATE students SET is_active = FALSE WHERE id = ${bohdan.id}::BIGINT`;
  expect((await getLessonCopySource("teacher", originalId))?.studentIds).toEqual([anna.id]);
  await sql`UPDATE rooms SET is_active = FALSE WHERE id = ${room.id}::BIGINT`;
  expect(prepareLessonCopy(source, { ...available, rooms: await listRooms({ activeOnly: true }) }).unavailableFields).toEqual(["аудиторія"]);
  expect((await createLesson("teacher", "teacher", { ...draft, dayOfWeek: String((weekday + 1) % 7 + 1) })).success).toBe(false);
  await sql`DELETE FROM lessons WHERE id = ${copied.lessonId!}::BIGINT`;
  expect(await getLessonCopySource("teacher", copied.lessonId!)).toBeNull();
  expect((await listJournalStudents("teacher", await findJournal(originalId)))[0].status).toBe("present");
}, 120000);
