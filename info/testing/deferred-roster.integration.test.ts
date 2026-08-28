import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { getDb } from "@/lib/db";
import { createLesson } from "@/lib/lessons/create";
import { addLessonStudents, getEditableLessonRoster } from "@/lib/lessons/roster";
import { listTeacherLessons } from "@/lib/lessons/repository";
import { listGroupStudents, listStudentGroups } from "@/lib/groups/repository";
import { listLessonTypes } from "@/lib/lesson-types/repository";
import { addStudentToTeacherSubject, listTeacherStudents } from "@/lib/students/repository";
import { listJournalLessons, listJournalStudents, saveAttendance } from "@/lib/attendance/repository";
import { getDateKeyInTimeZone } from "@/lib/schedule-week/rules";

it.skipIf(!process.env.VIDMITKA_ATTENDANCE_TEST_SCHEMA)("порожнє заняття → пізніше додавання → незмінні журнали й незалежні списки", async () => {
  const sql = getDb();
  const [scope] = await sql`SELECT current_schema() AS name` as unknown as { name: string }[];
  expect(scope.name).toBe(process.env.VIDMITKA_ATTENDANCE_TEST_SCHEMA);
  expect(scope.name).toMatch(/^codex_attendance_test_[0-9a-f]{16}$/u);
  const date = getDateKeyInTimeZone(new Date());
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay() || 7;
  await sql`INSERT INTO schedule_week_settings (id, anchor_date, anchor_week_type) VALUES (1, ${date}::DATE, 'numerator')`;
  const [subject] = await sql`SELECT id::TEXT AS id FROM subjects ORDER BY id LIMIT 1` as unknown as { id: string }[];
  const [room] = await sql`SELECT id::TEXT AS id FROM rooms ORDER BY id LIMIT 1` as unknown as { id: string }[];
  const periods = await sql`SELECT id::TEXT AS id FROM class_periods ORDER BY number` as unknown as { id: string }[];
  const draft = { subjectId: subject.id, roomId: room.id, classPeriodId: periods[0].id,
    lessonTypeId: (await listLessonTypes({ activeOnly: true }))[0].id, dayOfWeek: String(weekday), weekType: "both", groupNames: [], studentIds: [] };
  expect(await listStudentGroups()).toHaveLength(0);
  expect(await listGroupStudents()).toHaveLength(0);
  const first = await createLesson("teacher", "teacher", draft);
  expect(first.success).toBe(true);
  expect(first.lessonId).toBeDefined();
  expect(first.message).toContain("без студентів");
  const firstId = first.lessonId!;
  const assigned = await createLesson("administrator", "other-teacher", { ...draft, classPeriodId: periods[1].id });
  expect(assigned.success).toBe(true);
  expect((await createLesson("teacher", "other-teacher", { ...draft, classPeriodId: periods[2].id })).success).toBe(false);
  expect((await createLesson("teacher", "teacher", draft)).success).toBe(false);
  expect((await createLesson("other-teacher", "other-teacher", draft)).success).toBe(false);
  expect((await listTeacherLessons("teacher"))[0]).toMatchObject({ rosterMode: "selected", studentCount: 0, groupNames: [] });

  const studentInput = { teacherUserId: "teacher", fullName: "Ковальчук Анна", groupMode: "new", existingGroupName: null, newGroupName: "КН-51", subjectId: subject.id, subgroup: "1" };
  expect((await addStudentToTeacherSubject(studentInput)).success).toBe(true);
  expect((await addStudentToTeacherSubject({ ...studentInput, fullName: "Мельник Богдан", groupMode: "existing", existingGroupName: "КН-51" })).success).toBe(true);
  expect((await addStudentToTeacherSubject({ ...studentInput, teacherUserId: "other-teacher", fullName: "Шевченко Марія", newGroupName: "КН-52" })).success).toBe(true);
  const students = await listGroupStudents();
  const anna = students.find((student) => student.fullName === "Ковальчук Анна")!;
  const bohdan = students.find((student) => student.fullName === "Мельник Богдан")!;
  const maria = students.find((student) => student.fullName === "Шевченко Марія")!;
  const findLesson = async (id: string, at = date) => (await listJournalLessons("teacher", at)).lessons.find((lesson) => lesson.lessonId === id)!;
  expect(await listJournalStudents("teacher", await findLesson(firstId))).toHaveLength(0);
  const second = await createLesson("teacher", "teacher", { ...draft, classPeriodId: periods[2].id });
  expect(second.success).toBe(true);
  expect(await listJournalStudents("teacher", await findLesson(second.lessonId!))).toHaveLength(0);
  expect((await createLesson("teacher", "teacher", { ...draft, classPeriodId: periods[3].id, groupNames: ["КН-51"] })).success).toBe(true);

  const selection = { groupNames: ["КН-51"], studentIds: [anna.id] };
  expect(await getEditableLessonRoster("other-teacher", firstId)).toBeNull();
  expect(await getEditableLessonRoster("teacher", "bad")).toBeNull();
  expect((await getEditableLessonRoster("administrator", firstId))?.studentIds).toEqual([]);
  expect((await addLessonStudents("other-teacher", firstId, selection)).success).toBe(false);
  expect((await addLessonStudents("teacher", firstId, { groupNames: [], studentIds: [] })).success).toBe(false);
  expect((await addLessonStudents("teacher", firstId, { ...selection, studentIds: [anna.id, maria.id] })).success).toBe(false);
  expect((await addLessonStudents("teacher", firstId, { ...selection, studentIds: [anna.id, "999999999"] })).success).toBe(false);
  expect((await getEditableLessonRoster("teacher", firstId))?.studentIds).toEqual([]);
  expect((await listTeacherStudents("teacher")).some((student) => student.studentId === maria.id)).toBe(false);
  await sql`UPDATE students SET is_active = FALSE WHERE id = ${anna.id}::BIGINT`;
  expect((await addLessonStudents("teacher", firstId, selection)).success).toBe(false);
  await sql`UPDATE students SET is_active = TRUE WHERE id = ${anna.id}::BIGINT`;
  expect((await addLessonStudents("teacher", firstId, selection)).success).toBe(true);
  expect((await addLessonStudents("teacher", firstId, selection)).message).toContain("вже є");
  expect((await getEditableLessonRoster("teacher", firstId))?.studentIds).toEqual([anna.id]);
  expect((await listTeacherStudents("teacher")).find((student) => student.studentId === anna.id)?.subgroup).toBe("1");
  expect(await listJournalStudents("teacher", await findLesson(second.lessonId!))).toHaveLength(0);

  const lesson = await findLesson(firstId);
  expect((await saveAttendance("teacher", { date, key: lesson.key, version: 0, calendarToken: (await listJournalLessons("teacher", date)).day!.token,
    marks: [{ studentId: anna.id, status: "present" }] })).success).toBe(true);
  expect((await addLessonStudents("teacher", firstId, { ...selection, studentIds: [bohdan.id] })).success).toBe(true);
  const updatedRoster = await listJournalStudents("teacher", await findLesson(firstId));
  expect(updatedRoster.find((student) => student.studentId === anna.id)?.status).toBe("present");
  expect(updatedRoster.find((student) => student.studentId === bohdan.id)?.status).toBe("unmarked");
  const entries = (await sql`SELECT e.student_id::TEXT AS student_id, e.status
    FROM attendance_entries e JOIN attendance_sessions a ON a.id = e.session_id WHERE a.lesson_id = ${firstId}::BIGINT`
  ) as unknown as { student_id: string; status: string }[];
  expect(entries).toEqual([{ student_id: anna.id, status: "present" }]);
  const nextWeek = new Date(`${date}T12:00:00Z`); nextWeek.setUTCDate(nextWeek.getUTCDate() + 7);
  const future = nextWeek.toISOString().slice(0, 10);
  expect(await listJournalStudents("teacher", await findLesson(firstId, future))).toHaveLength(2);
  expect((await addLessonStudents("administrator", assigned.lessonId!, selection)).success).toBe(true);
  expect((await getEditableLessonRoster("other-teacher", assigned.lessonId!))?.studentIds).toEqual([anna.id]);
  await sql`UPDATE lessons SET roster_mode = 'subject' WHERE id = ${second.lessonId!}::BIGINT`;
  expect(await getEditableLessonRoster("teacher", second.lessonId!)).toBeNull();
  expect((await addLessonStudents("teacher", second.lessonId!, selection)).success).toBe(false);
}, 120000);
