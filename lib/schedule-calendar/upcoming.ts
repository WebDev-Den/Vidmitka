import "server-only";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import type { AlternatingWeekType } from "@/lib/schedule-week/rules";

export type UpcomingLesson = Readonly<{
  id: string; date: string; periodNumber: number; startMinute: number; endMinute: number;
  subjectName: string; roomName: string; teacherName: string; lessonTypeName: string | null;
  lessonTypeColor: string | null;
  isMakeup: boolean; isCurrent: boolean; weekType: AlternatingWeekType | null;
}>;

export const UPCOMING_LESSON_LIMIT = 3;

/** Найближчі проведення; однаковий час перемішується до обмеження кількості. */
export async function listUpcomingLessons(now: Date, rotationSeed: string = randomUUID()): Promise<UpcomingLesson[]> {
  const sql = getDb();
  const rows = await sql`
    WITH clock AS (
      SELECT ${now.toISOString()}::TIMESTAMPTZ AT TIME ZONE 'Europe/Kyiv' AS local_now
    ), exceptions AS MATERIALIZED (
      SELECT held_on FROM makeup_days, clock WHERE is_active AND held_on >= local_now::DATE
    ), dates AS (
      -- Кожне регулярне заняття повторюється не рідше разу на 14 днів.
      -- Один цикл на місце картки + один за кожну можливу підміну,
      -- якщо є регулярний розклад; далекі явні відпрацювання додаються окремо.
      SELECT clock.local_now::DATE + candidate.day_offset AS held_on
      FROM clock CROSS JOIN LATERAL GENERATE_SERIES(0, LEAST(
        14 * (${UPCOMING_LESSON_LIMIT} + (SELECT COUNT(*)::INT FROM exceptions)),
        DATE '9999-12-31' - clock.local_now::DATE
      )) candidate(day_offset)
      UNION SELECT held_on FROM exceptions
    ), days AS MATERIALIZED (
      SELECT context.* FROM dates CROSS JOIN LATERAL get_schedule_day(dates.held_on) context
    )
    SELECT l.id, days.held_on::TEXT AS date, p.number AS period_number, p.start_minute, p.end_minute,
      s.name AS subject_name, r.name AS room_name, u.full_name AS teacher_name,
      t.name AS lesson_type_name, t.color AS lesson_type_color, days.is_makeup, days.week_type,
      days.held_on + p.start_minute * INTERVAL '1 minute' <= clock.local_now AS is_current
    FROM days CROSS JOIN clock
    JOIN lessons l ON l.day_of_week = days.schedule_day
      AND (l.week_type = 'both' OR l.week_type = days.week_type)
    JOIN teacher_subjects ts ON ts.id = l.teacher_subject_id
    JOIN app_users u ON u.id = l.teacher_user_id AND u.id = ts.teacher_user_id AND u.approval_status = 'approved'
    JOIN subjects s ON s.id = ts.subject_id JOIN rooms r ON r.id = l.room_id
    JOIN class_periods p ON p.id = l.class_period_id
    LEFT JOIN lesson_types t ON t.id = l.lesson_type_id
    WHERE days.held_on + p.end_minute * INTERVAL '1 minute' > clock.local_now
    -- New request seed changes ties across the entire candidate pool, not only three preselected rows.
    ORDER BY days.held_on, p.start_minute,
      MD5(${rotationSeed}::TEXT || ':' || l.id::TEXT || ':' || days.held_on::TEXT), l.id
    LIMIT ${UPCOMING_LESSON_LIMIT}
  ` as unknown as {
    id: string | number; date: string; period_number: number; start_minute: number; end_minute: number;
    subject_name: string; room_name: string; teacher_name: string; lesson_type_name: string | null;
    lesson_type_color: string | null;
    is_makeup: boolean; is_current: boolean; week_type: AlternatingWeekType | null;
  }[];
  return rows.map((row) => ({ id: String(row.id), date: row.date, periodNumber: row.period_number,
    startMinute: row.start_minute, endMinute: row.end_minute, subjectName: row.subject_name,
    roomName: row.room_name, teacherName: row.teacher_name, lessonTypeName: row.lesson_type_name,
    lessonTypeColor: row.lesson_type_color,
    isMakeup: row.is_makeup, isCurrent: row.is_current, weekType: row.week_type }));
}
