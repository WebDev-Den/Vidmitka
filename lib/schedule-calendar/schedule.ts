import "server-only";

import { getDb } from "@/lib/db";
import type { LessonWeekType } from "@/lib/schedule-week/rules";
import { getScheduleDayContext } from "./repository";

export type ScheduledLesson = Readonly<{
  id: string;
  subjectName: string;
  lessonTypeName: string | null;
  teacherName: string;
  roomName: string;
  periodNumber: number;
  startMinute: number;
  endMinute: number;
  weekType: LessonWeekType;
  groupNames: string[];
}>;

export async function listScheduleForDate(date: string) {
  const day = await getScheduleDayContext(date);
  const sql = getDb();
  const rows = await sql`
    SELECT l.id, s.name AS subject_name, u.full_name AS teacher_name, r.name AS room_name,
      p.number AS period_number, p.start_minute, p.end_minute, l.week_type, t.name AS lesson_type_name,
      ARRAY(
        SELECT DISTINCT student.group_name FROM subject_students ss
        JOIN students student ON student.id = ss.student_id
        WHERE ss.teacher_subject_id = ts.id AND student.is_active
          AND (l.roster_mode = 'subject' OR EXISTS (
            SELECT 1 FROM lesson_students ls WHERE ls.lesson_id = l.id AND ls.student_id = student.id
          ))
        ORDER BY student.group_name
      ) AS group_names
    FROM lessons l JOIN teacher_subjects ts ON ts.id = l.teacher_subject_id
    JOIN app_users u ON u.id = l.teacher_user_id AND u.id = ts.teacher_user_id
    JOIN subjects s ON s.id = ts.subject_id JOIN rooms r ON r.id = l.room_id
    JOIN class_periods p ON p.id = l.class_period_id
    LEFT JOIN lesson_types t ON t.id = l.lesson_type_id
    WHERE u.approval_status = 'approved' AND l.day_of_week = ${day.dayOfWeek}
      AND (l.week_type = 'both' OR l.week_type = ${day.weekType})
    ORDER BY p.start_minute, p.number, s.name, u.full_name, r.name, l.id
  ` as unknown as {
    id: string | number; subject_name: string; teacher_name: string; room_name: string; lesson_type_name: string | null;
    period_number: number; start_minute: number; end_minute: number;
    week_type: LessonWeekType; group_names: string[];
  }[];
  return { day, lessons: rows.map((row): ScheduledLesson => ({
    id: String(row.id), subjectName: row.subject_name, teacherName: row.teacher_name, lessonTypeName: row.lesson_type_name,
    roomName: row.room_name, periodNumber: row.period_number, startMinute: row.start_minute,
    endMinute: row.end_minute, weekType: row.week_type, groupNames: row.group_names,
  })) };
}
