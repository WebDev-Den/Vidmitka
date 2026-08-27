import "server-only";

import { formatMinute } from "@/lib/class-periods/rules";
import { getDb } from "@/lib/db";
import type { LessonWeekType } from "@/lib/schedule-week/rules";

export type TeacherLesson = Readonly<{
  id: string;
  subjectName: string;
  roomName: string;
  dayOfWeek: number;
  periodNumber: number;
  periodTime: string;
  weekType: LessonWeekType;
}>;

type TeacherLessonRow = {
  id: string | number;
  subject_name: string;
  room_name: string;
  day_of_week: number;
  period_number: number;
  start_minute: number;
  end_minute: number;
  week_type: LessonWeekType;
};

export async function listTeacherLessons(
  teacherUserId: string,
): Promise<TeacherLesson[]> {
  const sql = getDb();
  const rows = (await sql`
    SELECT
      lesson.id,
      subject.name AS subject_name,
      room.name AS room_name,
      lesson.day_of_week,
      period.number AS period_number,
      period.start_minute,
      period.end_minute,
      lesson.week_type
    FROM lessons AS lesson
    JOIN teacher_subjects AS teacher_subject
      ON teacher_subject.id = lesson.teacher_subject_id
    JOIN subjects AS subject ON subject.id = teacher_subject.subject_id
    JOIN rooms AS room ON room.id = lesson.room_id
    JOIN class_periods AS period ON period.id = lesson.class_period_id
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
    roomName: row.room_name,
    dayOfWeek: row.day_of_week,
    periodNumber: row.period_number,
    periodTime: `${formatMinute(row.start_minute)}–${formatMinute(row.end_minute)}`,
    weekType: row.week_type,
  }));
}
