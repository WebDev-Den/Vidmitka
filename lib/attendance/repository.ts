import "server-only";
import { getDb } from "@/lib/db";
import { getScheduleWeekSettings } from "@/lib/schedule-week/repository";
import { getDateKeyInTimeZone, getWeekTypeForDate } from "@/lib/schedule-week/rules";
import { isAttendanceStatus, isJournalDate, type AttendanceStudent } from "./rules";

export type JournalLesson = {
  key: string; lessonId: string | null; sessionId: string | null; teacherSubjectId: string;
  subjectId: string; subjectName: string; roomName: string; periodNumber: number;
  startMinute: number; endMinute: number; version: number; archived: boolean;
};
type LessonRow = {
  lesson_id: string | number | null; session_id: string | number | null; teacher_subject_id: string | number;
  subject_id: string | number; subject_name: string; room_name: string; period_number: number;
  start_minute: number; end_minute: number; version: number; archived: boolean;
};

export async function listJournalLessons(teacherUserId: string, date: string) {
  if (!isJournalDate(date)) return { lessons: [], weekType: null };
  const settings = await getScheduleWeekSettings();
  const weekType = settings ? getWeekTypeForDate(date, settings) : null;
  const sql = getDb();
  const rows = await sql`
    WITH scheduled AS (
      SELECT l.id, l.teacher_subject_id, ts.subject_id, s.name AS subject_name,
        r.name AS room_name, p.number AS period_number, p.start_minute, p.end_minute
      FROM lessons l JOIN teacher_subjects ts ON ts.id = l.teacher_subject_id
      JOIN subjects s ON s.id = ts.subject_id JOIN rooms r ON r.id = l.room_id
      JOIN class_periods p ON p.id = l.class_period_id
      WHERE l.teacher_user_id = ${teacherUserId} AND ts.teacher_user_id = ${teacherUserId}
        AND l.day_of_week = EXTRACT(ISODOW FROM ${date}::DATE)
        AND (l.week_type = 'both' OR l.week_type = ${weekType})
    )
    SELECT l.id AS lesson_id, a.id AS session_id, l.teacher_subject_id, l.subject_id,
      COALESCE(a.subject_name, l.subject_name) AS subject_name,
      COALESCE(a.room_name, l.room_name) AS room_name,
      COALESCE(a.period_number, l.period_number) AS period_number,
      COALESCE(a.start_minute, l.start_minute) AS start_minute,
      COALESCE(a.end_minute, l.end_minute) AS end_minute,
      COALESCE(a.version, 0) AS version, FALSE AS archived
    FROM scheduled l LEFT JOIN attendance_sessions a ON a.lesson_id = l.id AND a.held_on = ${date}::DATE
      AND a.teacher_user_id = ${teacherUserId}
    UNION ALL
    SELECT a.lesson_id, a.id, a.teacher_subject_id, ts.subject_id, a.subject_name, a.room_name,
      a.period_number, a.start_minute, a.end_minute, a.version, TRUE AS archived
    FROM attendance_sessions a JOIN teacher_subjects ts ON ts.id = a.teacher_subject_id
    WHERE a.teacher_user_id = ${teacherUserId} AND a.held_on = ${date}::DATE
      AND NOT EXISTS (SELECT 1 FROM scheduled l WHERE l.id = a.lesson_id)
    ORDER BY start_minute, subject_name
  ` as unknown as LessonRow[];
  return { weekType, lessons: rows.map((row): JournalLesson => ({
    key: row.archived ? `session:${row.session_id}` : `lesson:${row.lesson_id}`,
    lessonId: row.lesson_id === null ? null : String(row.lesson_id),
    sessionId: row.session_id === null ? null : String(row.session_id),
    teacherSubjectId: String(row.teacher_subject_id), subjectId: String(row.subject_id),
    subjectName: row.subject_name, roomName: row.room_name, periodNumber: row.period_number,
    startMinute: row.start_minute, endMinute: row.end_minute, version: row.version, archived: row.archived,
  })) };
}

export async function listJournalStudents(teacherUserId: string, lesson: JournalLesson): Promise<AttendanceStudent[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT e.student_id, e.full_name, e.group_name, e.subgroup, e.status
    FROM attendance_entries e JOIN attendance_sessions a ON a.id = e.session_id
    WHERE a.id = ${lesson.sessionId}::BIGINT AND a.teacher_user_id = ${teacherUserId}
    UNION ALL
    SELECT s.id, s.full_name, s.group_name, ss.subgroup, 'unmarked' AS status
    FROM subject_students ss JOIN students s ON s.id = ss.student_id
    JOIN teacher_subjects ts ON ts.id = ss.teacher_subject_id
    WHERE ts.id = ${lesson.teacherSubjectId}::BIGINT AND ts.teacher_user_id = ${teacherUserId}
      AND NOT ${lesson.archived} AND s.is_active
      AND EXISTS (SELECT 1 FROM lessons l WHERE l.id = ${lesson.lessonId}::BIGINT
        AND l.teacher_user_id = ${teacherUserId} AND l.teacher_subject_id = ts.id
        AND (l.roster_mode = 'subject' OR EXISTS (
          SELECT 1 FROM lesson_students ls WHERE ls.lesson_id = l.id AND ls.student_id = s.id
        )))
      AND NOT EXISTS (SELECT 1 FROM attendance_entries e WHERE e.session_id = ${lesson.sessionId}::BIGINT AND e.student_id = s.id)
    ORDER BY group_name, full_name
  ` as unknown as { student_id: string | number; full_name: string; group_name: string; subgroup: string; status: AttendanceStudent["status"] }[];
  return rows.map((row) => ({ studentId: String(row.student_id), fullName: row.full_name as string,
    groupName: row.group_name as string, subgroup: row.subgroup as string, status: row.status as AttendanceStudent["status"] }));
}

export async function saveAttendance(teacherUserId: string, input: {
  date: string; key: string; version: number; marks: { studentId: string; status: string }[];
}) {
  const fail = (message: string) => ({ success: false, message });
  if (!isJournalDate(input.date)) return fail("Вкажіть коректну дату заняття.");
  if (input.date > getDateKeyInTimeZone(new Date())) return fail("Не можна відмічати майбутні заняття.");
  if (!Number.isInteger(input.version) || input.version < 0 || !Array.isArray(input.marks)
    || input.marks.length > 5000 || input.marks.some((mark) => !mark || !/^[1-9]\d{0,17}$/u.test(mark.studentId) || !isAttendanceStatus(mark.status))
    || new Set(input.marks.map((mark) => mark.studentId)).size !== input.marks.length) return fail("Некоректні відмітки журналу.");
  const { lessons } = await listJournalLessons(teacherUserId, input.date);
  const lesson = lessons.find((item) => item.key === input.key);
  if (!lesson) return fail("Ваше заняття на цю дату не знайдено.");
  if (lesson.version !== input.version) return fail("Журнал уже змінено. Оновіть сторінку перед повторним збереженням.");
  const roster = await listJournalStudents(teacherUserId, lesson);
  const marks = new Map(input.marks.map((mark) => [mark.studentId, mark.status]));
  if (!roster.length || roster.length !== marks.size || roster.some((student) => !marks.has(student.studentId))) {
    return fail("Список студентів змінився або порожній. Оновіть сторінку.");
  }
  const data = JSON.stringify(roster.map((row) => ({ ...row, status: marks.get(row.studentId) })));
  const sql = getDb();
  // Версія та повний склад перевіряються в тій самій операції, що й запис.
  const result = await sql`
    WITH imported AS (
      SELECT * FROM JSONB_TO_RECORDSET(${data}::JSONB)
      AS item("studentId" BIGINT, "fullName" TEXT, "groupName" TEXT, subgroup TEXT, status TEXT)
    ), current_roster AS (
      SELECT e.student_id FROM attendance_entries e JOIN attendance_sessions a ON a.id = e.session_id
      WHERE a.id = ${lesson.sessionId}::BIGINT AND a.teacher_user_id = ${teacherUserId}
      UNION
      SELECT ss.student_id FROM subject_students ss JOIN teacher_subjects ts ON ts.id = ss.teacher_subject_id
      JOIN students s ON s.id = ss.student_id
      WHERE ts.id = ${lesson.teacherSubjectId}::BIGINT AND ts.teacher_user_id = ${teacherUserId}
        AND NOT ${lesson.archived} AND s.is_active
        AND EXISTS (SELECT 1 FROM lessons l WHERE l.id = ${lesson.lessonId}::BIGINT
          AND l.teacher_user_id = ${teacherUserId} AND l.teacher_subject_id = ts.id
          AND (l.roster_mode = 'subject' OR EXISTS (
            SELECT 1 FROM lesson_students ls WHERE ls.lesson_id = l.id AND ls.student_id = s.id
          )))
    ), valid AS (
      SELECT NOT EXISTS (SELECT student_id FROM current_roster EXCEPT SELECT "studentId" FROM imported)
        AND NOT EXISTS (SELECT "studentId" FROM imported EXCEPT SELECT student_id FROM current_roster) AS ok
    ), created AS (
      INSERT INTO attendance_sessions (lesson_id, teacher_subject_id, teacher_user_id, held_on,
        subject_name, room_name, period_number, start_minute, end_minute)
      SELECT l.id, l.teacher_subject_id, ${teacherUserId}, ${input.date}::DATE,
        ${lesson.subjectName}, ${lesson.roomName}, ${lesson.periodNumber}, ${lesson.startMinute}, ${lesson.endMinute}
      FROM lessons l CROSS JOIN valid
      WHERE ${input.version} = 0 AND valid.ok AND l.id = ${lesson.lessonId}::BIGINT
        AND l.teacher_user_id = ${teacherUserId} AND l.teacher_subject_id = ${lesson.teacherSubjectId}::BIGINT
        AND l.day_of_week = EXTRACT(ISODOW FROM ${input.date}::DATE)
        AND (l.week_type = 'both' OR l.week_type = (
          SELECT CASE WHEN (
            (DATE_TRUNC('week', ${input.date}::DATE::TIMESTAMP)::DATE - DATE_TRUNC('week', anchor_date::TIMESTAMP)::DATE) / 7
          ) % 2 = 0 THEN anchor_week_type
            WHEN anchor_week_type = 'numerator' THEN 'denominator' ELSE 'numerator' END
          FROM schedule_week_settings WHERE id = 1
        ))
      ON CONFLICT (lesson_id, held_on) DO NOTHING RETURNING id
    ), updated AS (
      UPDATE attendance_sessions SET version = version + 1, updated_at = NOW()
      WHERE id = ${lesson.sessionId}::BIGINT AND teacher_user_id = ${teacherUserId}
        AND held_on = ${input.date}::DATE AND version = ${input.version} AND (SELECT ok FROM valid)
      RETURNING id
    ), session AS (SELECT id FROM created UNION ALL SELECT id FROM updated)
    INSERT INTO attendance_entries (session_id, student_id, full_name, group_name, subgroup, status)
    SELECT session.id, i."studentId", i."fullName", i."groupName", i.subgroup, i.status FROM imported i CROSS JOIN session
    ON CONFLICT (session_id, student_id) DO UPDATE SET status = EXCLUDED.status
    RETURNING student_id
  ` as unknown as { student_id: string | number }[];
  return result.length === roster.length ? { success: true, message: "Відмітки збережено." }
    : fail("Журнал або список студентів уже змінено. Оновіть сторінку.");
}
