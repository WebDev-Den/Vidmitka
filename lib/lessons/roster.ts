import "server-only";
import { getDb } from "@/lib/db";
import { validateLessonStudentSelection, type LessonStudentSelectionInput } from "./student-selection";

export type EditableLessonRoster = { id: string; subjectName: string; studentIds: string[] };

export async function getEditableLessonRoster(actorId: string, lessonId: string): Promise<EditableLessonRoster | null> {
  if (!/^[1-9]\d{0,17}$/u.test(lessonId)) return null;
  const [row] = await getDb()`
    SELECT l.id::TEXT AS id, s.name AS subject_name,
      ARRAY(SELECT ls.student_id::TEXT FROM lesson_students ls WHERE ls.lesson_id = l.id ORDER BY ls.student_id) AS student_ids
    FROM lessons l JOIN teacher_subjects ts ON ts.id = l.teacher_subject_id
    JOIN subjects s ON s.id = ts.subject_id
    JOIN app_users actor ON actor.id = ${actorId} AND actor.approval_status = 'approved'
    WHERE l.id = ${lessonId}::BIGINT AND l.roster_mode = 'selected'
      AND ts.teacher_user_id = l.teacher_user_id
      AND (actor.role = 'administrator' OR (actor.role = 'teacher' AND l.teacher_user_id = actor.id))
  ` as unknown as { id: string; subject_name: string; student_ids: string[] }[];
  return row ? { id: row.id, subjectName: row.subject_name, studentIds: row.student_ids } : null;
}

export async function addLessonStudents(actorId: string, lessonId: string, input: LessonStudentSelectionInput): Promise<{ success: boolean; message: string }> {
  if (!/^[1-9]\d{0,17}$/u.test(lessonId)) return { success: false, message: "Некоректне заняття." };
  const validation = validateLessonStudentSelection(input, true);
  if (!validation.ok) return { success: false, message: validation.message };
  const selection = validation.value;
  // Validate the complete selection and permission inside the same atomic write.
  // Only append links: saved attendance and other selected rosters stay untouched.
  const [result] = await getDb()`
    WITH selected AS (
      SELECT id FROM students WHERE is_active
        AND id IN (SELECT value::BIGINT FROM JSONB_ARRAY_ELEMENTS_TEXT(${JSON.stringify(selection.studentIds)}::JSONB))
        AND group_name IN (SELECT value FROM JSONB_ARRAY_ELEMENTS_TEXT(${JSON.stringify(selection.groupNames)}::JSONB))
    ), target AS (
      SELECT l.id, l.teacher_subject_id FROM lessons l
      JOIN teacher_subjects ts ON ts.id = l.teacher_subject_id AND ts.teacher_user_id = l.teacher_user_id
      JOIN subjects s ON s.id = ts.subject_id AND s.is_active
      JOIN app_users actor ON actor.id = ${actorId} AND actor.approval_status = 'approved'
      WHERE l.id = ${lessonId}::BIGINT AND l.roster_mode = 'selected'
        AND (actor.role = 'administrator' OR (actor.role = 'teacher' AND l.teacher_user_id = actor.id))
        AND (SELECT COUNT(*) FROM selected) = ${selection.studentIds.length}
        AND (SELECT COUNT(*) FROM student_groups WHERE name IN (
          SELECT value FROM JSONB_ARRAY_ELEMENTS_TEXT(${JSON.stringify(selection.groupNames)}::JSONB)
        )) = ${selection.groupNames.length}
    ), enrolled AS (
      INSERT INTO subject_students (teacher_subject_id, student_id)
      SELECT target.teacher_subject_id, selected.id FROM target CROSS JOIN selected
      ON CONFLICT (teacher_subject_id, student_id) DO NOTHING RETURNING student_id
    ), linked AS (
      INSERT INTO lesson_students (lesson_id, student_id)
      SELECT target.id, selected.id FROM target CROSS JOIN selected
      ON CONFLICT (lesson_id, student_id) DO NOTHING RETURNING student_id
    )
    SELECT target.id, (SELECT COUNT(*)::INT FROM linked) AS added_count FROM target
  ` as unknown as { id: string | number; added_count: number }[];
  return result ? { success: true, message: result.added_count > 0
    ? `Додано студентів до заняття: ${result.added_count}. Збережені відмітки не змінено.`
    : "Вибрані студенти вже є в занятті. Повторні записи не додано." }
    : { success: false, message: "Заняття недоступне або список студентів / груп змінився. Оновіть сторінку." };
}
