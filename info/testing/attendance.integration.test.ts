import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { getDb } from "@/lib/db";
import { importTeacherStudents } from "@/lib/students/import-repository";
import { parseStudentImport } from "@/lib/students/import-parser";
import { importTeacherSchedule } from "@/lib/schedule-import/repository";
import { listJournalLessons, listJournalStudents, saveAttendance } from "@/lib/attendance/repository";
import { applyAudience, attendanceSummary } from "@/lib/attendance/rules";
import { getDateKeyInTimeZone } from "@/lib/schedule-week/rules";
import { endSemester } from "@/lib/semesters/repository";

it.skipIf(!process.env.VIDMITKA_ATTENDANCE_TEST_SCHEMA)("ізольована БД: імпорт → журнал → відмітки → архів", async () => {
  const sql = getDb();
  const [scope] = await sql`SELECT current_schema() AS name` as unknown as { name: string }[];
  expect(scope.name).toBe(process.env.VIDMITKA_ATTENDANCE_TEST_SCHEMA);
  expect(scope.name).toMatch(/^codex_attendance_test_[0-9a-f]{16}$/u);
  const date = getDateKeyInTimeZone(new Date());
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay() || 7;
  await sql`INSERT INTO schedule_week_settings (id, anchor_date, anchor_week_type) VALUES (1, ${date}::DATE, 'numerator')`;
  const schedule = [
    { rowNumber: 1, subjectName: "Основи програмування", roomName: "101", dayOfWeek: weekday, periodNumber: 1, weekType: "both" as const },
    { rowNumber: 2, subjectName: "Основи програмування", roomName: "101", dayOfWeek: weekday, periodNumber: 2, weekType: "numerator" as const },
    { rowNumber: 3, subjectName: "Основи програмування", roomName: "101", dayOfWeek: weekday, periodNumber: 2, weekType: "denominator" as const },
  ];
  expect((await importTeacherSchedule("teacher", schedule)).success).toBe(true);
  expect((await importTeacherSchedule("other-teacher", [{ ...schedule[0], roomName: "102" }])).success).toBe(true);
  const initial = await listJournalLessons("teacher", date);
  expect(initial.lessons).toHaveLength(2);
  const lesson = initial.lessons[0];
  const nextWeek = new Date(`${date}T12:00:00Z`); nextWeek.setUTCDate(nextWeek.getUTCDate() + 7);
  const futureDate = nextWeek.toISOString().slice(0, 10);
  const following = await listJournalLessons("teacher", futureDate);
  expect(following.weekType).toBe("denominator");
  expect(following.lessons[1].lessonId).not.toBe(initial.lessons[1].lessonId);

  const parsed = parseStudentImport("students.csv", "fullName,groupName,subgroup\nКовальчук Анна,КН-21,1\nМельник Богдан,КН-21,2\nШевченко Марія,КН-22,1");
  if (!parsed.ok) throw new Error("Fixture parse failed");
  expect((await importTeacherStudents("other-teacher", { lessonId: lesson.lessonId! }, parsed.rows)).success).toBe(false);
  expect((await importTeacherStudents("teacher", { lessonId: lesson.lessonId! }, parsed.rows)).success).toBe(true);
  expect((await importTeacherStudents("teacher", { lessonId: lesson.lessonId! }, parsed.rows)).success).toBe(true);
  let students = await listJournalStudents("teacher", lesson);
  expect(students).toHaveLength(3);
  expect(await listJournalStudents("other-teacher", lesson)).toHaveLength(0);
  // Відсутнє поле не стирає вже відому підгрупу.
  await importTeacherStudents("teacher", { lessonId: lesson.lessonId! }, [{ ...parsed.rows[0], subgroup: null }]);
  expect((await listJournalStudents("teacher", lesson))[0].subgroup).toBe("1");
  const selected = applyAudience(students, "КН-21", "1").map((row) => ({ ...row, status: row.status === "not_required" ? row.status : "present" as const }));
  const input = { date, key: lesson.key, version: 0, marks: selected.map(({ studentId, status }) => ({ studentId, status })) };
  expect((await saveAttendance("other-teacher", input)).success).toBe(false);
  expect((await saveAttendance("teacher", { ...input, marks: [...input.marks, { studentId: "999999", status: "absent" }] })).success).toBe(false);
  expect((await saveAttendance("teacher", { ...input, date: futureDate })).success).toBe(false);
  expect((await saveAttendance("teacher", { ...input, date: "2026-02-30" })).success).toBe(false);
  const parallel = await Promise.all([saveAttendance("teacher", input), saveAttendance("teacher", input)]);
  expect(parallel.filter((result) => result.success)).toHaveLength(1);
  let saved = (await listJournalLessons("teacher", date)).lessons[0];
  expect(saved.version).toBe(1);
  students = await listJournalStudents("teacher", saved);
  expect(attendanceSummary(students)).toMatchObject({ present: 1, absent: 0, notRequired: 2, expected: 1, percentage: 100 });
  expect((await listJournalStudents("teacher", initial.lessons[1])).every((row) => row.status === "unmarked")).toBe(true);
  expect((await saveAttendance("teacher", input)).success).toBe(false);
  expect((await saveAttendance("teacher", { ...input, version: 1, marks: input.marks.map((mark, i) => i === 0 ? { ...mark, status: "absent" } : mark) })).success).toBe(true);
  saved = (await listJournalLessons("teacher", date)).lessons[0];
  expect(saved.version).toBe(2);
  expect(attendanceSummary(await listJournalStudents("teacher", saved)).absent).toBe(1);
  await sql`DELETE FROM subject_students WHERE teacher_subject_id = ${saved.teacherSubjectId}::BIGINT`;
  expect(await listJournalStudents("teacher", saved)).toHaveLength(3);
  expect((await endSemester("administrator")).success).toBe(true);
  const archived = (await listJournalLessons("teacher", date)).lessons[0];
  expect(archived.archived).toBe(true);
  expect(archived.lessonId).toBe(null);
  expect(await listJournalStudents("teacher", archived)).toHaveLength(3);
  const [count] = await sql`SELECT COUNT(*)::INT AS n FROM students` as unknown as { n: number }[];
  expect(count.n).toBe(3);
  expect((await saveAttendance("teacher", { ...input, key: archived.key, version: 2 })).success).toBe(true);
  // Відновлюємо лише тестовий розклад, щоб браузер перевірив живий сценарій.
  await importTeacherSchedule("teacher", schedule);
  const live = (await listJournalLessons("teacher", date)).lessons.find((row) => !row.archived)!;
  await importTeacherStudents("teacher", { lessonId: live.lessonId! }, parsed.rows);
}, 120000);
