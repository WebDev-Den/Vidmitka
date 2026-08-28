import "server-only";

import { formatMinute } from "@/lib/class-periods/rules";
import { getDb } from "@/lib/db";
import type { LessonWeekType } from "@/lib/schedule-week/rules";

export type TeacherLesson = Readonly<{
  id: string;
  subjectName: string;
  lessonTypeName: string | null;
  lessonTypeId: string | null;
  createdByUserId: string;
  roomName: string;
  dayOfWeek: number;
  periodNumber: number;
  periodTime: string;
  weekType: LessonWeekType;
  rosterMode: "subject" | "selected";
  studentCount: number;
  groupNames: string[];
}>;

type TeacherLessonRow = {
  id: string | number;
  subject_name: string;
  lesson_type_name: string | null;
  lesson_type_id: string | number | null;
  created_by_user_id: string;
  room_name: string;
  day_of_week: number;
  period_number: number;
  start_minute: number;
  end_minute: number;
  week_type: LessonWeekType;
  roster_mode: "subject" | "selected";
  student_count: number;
  group_names: string[];
};

export async function listTeacherLessons(
  teacherUserId: string,
): Promise<TeacherLesson[]> {
  const sql = getDb();
  const rows = (await sql`
    SELECT
      lesson.id,
      subject.name AS subject_name,
      lesson_type.name AS lesson_type_name,
      lesson.lesson_type_id,
      lesson.created_by_user_id,
      room.name AS room_name,
      lesson.day_of_week,
      period.number AS period_number,
      period.start_minute,
      period.end_minute,
      lesson.week_type,
      lesson.roster_mode,
      roster.student_count,
      roster.group_names
    FROM lessons AS lesson
    JOIN teacher_subjects AS teacher_subject
      ON teacher_subject.id = lesson.teacher_subject_id
    JOIN subjects AS subject ON subject.id = teacher_subject.subject_id
    JOIN rooms AS room ON room.id = lesson.room_id
    JOIN class_periods AS period ON period.id = lesson.class_period_id
    LEFT JOIN lesson_types AS lesson_type ON lesson_type.id = lesson.lesson_type_id
    CROSS JOIN LATERAL (
      SELECT COUNT(*)::INT AS student_count, COALESCE(ARRAY_AGG(DISTINCT s.group_name ORDER BY s.group_name), ARRAY[]::TEXT[]) AS group_names
      FROM subject_students ss JOIN students s ON s.id = ss.student_id
      WHERE ss.teacher_subject_id = lesson.teacher_subject_id AND s.is_active
        AND (lesson.roster_mode = 'subject' OR EXISTS (SELECT 1 FROM lesson_students ls WHERE ls.lesson_id = lesson.id AND ls.student_id = s.id))
    ) roster
    WHERE lesson.teacher_user_id = ${teacherUserId}
    ORDER BY
      lesson.day_of_week ASC,
      period.number ASC,
      lesson.week_type ASC,
      subject.name ASC
  `) as unknown as TeacherLessonRow[];

  return rows.map((row) => ({
    id: String(row.id),
    subjectName: row.subject_name,
    lessonTypeName: row.lesson_type_name,
    lessonTypeId: row.lesson_type_id === null ? null : String(row.lesson_type_id),
    createdByUserId: row.created_by_user_id,
    roomName: row.room_name,
    dayOfWeek: row.day_of_week,
    periodNumber: row.period_number,
    periodTime: `${formatMinute(row.start_minute)}–${formatMinute(row.end_minute)}`,
    weekType: row.week_type,
    rosterMode: row.roster_mode,
    studentCount: row.student_count,
    groupNames: row.group_names,
  }));
}

export async function setLessonTypeForLesson(actorId: string, lessonId: string, typeId: string): Promise<{ success: boolean; message: string }> {
  if (![lessonId, typeId].every((id) => /^[1-9]\d{0,17}$/u.test(id))) return { success: false, message: "Оберіть заняття й тип із довідника." };
  const rows = await getDb()`
    UPDATE lessons l SET lesson_type_id = t.id
    FROM lesson_types t, app_users actor
    WHERE l.id = ${lessonId}::BIGINT AND t.id = ${typeId}::BIGINT AND t.is_active
      AND actor.id = ${actorId} AND actor.approval_status = 'approved'
      AND (actor.role = 'administrator' OR (l.teacher_user_id = actor.id AND l.created_by_user_id = actor.id))
    RETURNING l.id
  `;
  return rows.length ? { success: true, message: "Тип заняття збережено. Історичні журнали не змінено." }
    : { success: false, message: "Заняття недоступне для зміни або тип уже неактивний. Оновіть сторінку." };
}
