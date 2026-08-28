import "server-only";
import { getDb } from "@/lib/db";
import type { LessonCopySource } from "./copy-draft";

/** A copy is a read-only draft. Saving it uses the ordinary createLesson boundary. */
export async function getLessonCopySource(actorId: string, lessonId: string): Promise<LessonCopySource | null> {
  if (!/^[1-9]\d{0,17}$/u.test(lessonId)) return null;
  const [row] = await getDb()`
    SELECT l.id::TEXT AS id, l.teacher_user_id, ts.subject_id::TEXT AS subject_id,
      s.name AS subject_name, l.room_id::TEXT AS room_id, l.class_period_id::TEXT AS class_period_id,
      l.lesson_type_id::TEXT AS lesson_type_id, l.day_of_week, l.week_type, l.roster_mode,
      ARRAY(
        SELECT st.id::TEXT FROM subject_students ss JOIN students st ON st.id = ss.student_id
        WHERE ss.teacher_subject_id = ts.id AND st.is_active
          AND (l.roster_mode = 'subject' OR EXISTS (
            SELECT 1 FROM lesson_students ls WHERE ls.lesson_id = l.id AND ls.student_id = st.id
          ))
        ORDER BY st.id
      ) AS student_ids
    FROM lessons l JOIN teacher_subjects ts ON ts.id = l.teacher_subject_id AND ts.teacher_user_id = l.teacher_user_id
    JOIN subjects s ON s.id = ts.subject_id
    JOIN app_users actor ON actor.id = ${actorId} AND actor.approval_status = 'approved'
    WHERE l.id = ${lessonId}::BIGINT
      AND (actor.role = 'administrator' OR (actor.role = 'teacher' AND l.teacher_user_id = actor.id))
  ` as unknown as {
    id: string; teacher_user_id: string; subject_id: string; subject_name: string; room_id: string;
    class_period_id: string; lesson_type_id: string | null; day_of_week: number;
    week_type: LessonCopySource["weekType"]; roster_mode: LessonCopySource["rosterMode"]; student_ids: string[];
  }[];
  return row ? {
    id: row.id, teacherId: row.teacher_user_id, subjectId: row.subject_id, subjectName: row.subject_name,
    roomId: row.room_id, classPeriodId: row.class_period_id, lessonTypeId: row.lesson_type_id,
    dayOfWeek: row.day_of_week, weekType: row.week_type, rosterMode: row.roster_mode, studentIds: row.student_ids,
  } : null;
}
