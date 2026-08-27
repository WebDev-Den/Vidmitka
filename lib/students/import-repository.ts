import "server-only";
import { getDb } from "@/lib/db";
import type { StudentImportRow } from "./import-parser";

export type StudentImportTarget = { subjectId: string } | { lessonId: string };

export async function importTeacherStudents(teacherUserId: string, target: StudentImportTarget, rows: StudentImportRow[]) {
  const subjectId = "subjectId" in target ? target.subjectId : null;
  const lessonId = "lessonId" in target ? target.lessonId : null;
  if (!/^[1-9]\d{0,17}$/u.test(subjectId ?? lessonId ?? "") || !rows.length) {
    return { success: false, message: "Оберіть власне заняття або предмет." };
  }
  const sql = getDb();
  // Увесь файл — одна атомарна операція. Власник береться тільки із сесії.
  const result = await sql`
    WITH target AS (
      SELECT s.id FROM subjects s WHERE s.is_active AND (
        (${lessonId}::BIGINT IS NULL AND s.id = ${subjectId}::BIGINT)
        OR EXISTS (SELECT 1 FROM lessons l JOIN teacher_subjects ts ON ts.id = l.teacher_subject_id
          WHERE l.id = ${lessonId}::BIGINT AND l.teacher_user_id = ${teacherUserId}
          AND ts.teacher_user_id = ${teacherUserId} AND ts.subject_id = s.id)
      )
    ), imported AS (
      SELECT * FROM JSONB_TO_RECORDSET(${JSON.stringify(rows)}::JSONB)
      AS item("fullName" TEXT, "groupName" TEXT, subgroup TEXT)
    ), owned AS (
      INSERT INTO teacher_subjects (teacher_user_id, subject_id)
      SELECT ${teacherUserId}, id FROM target
      ON CONFLICT (teacher_user_id, subject_id) DO UPDATE SET teacher_user_id = EXCLUDED.teacher_user_id
      RETURNING id
    ), saved AS (
      INSERT INTO students (full_name, group_name)
      SELECT "fullName", "groupName" FROM imported WHERE EXISTS (SELECT 1 FROM owned)
      ON CONFLICT (full_name, group_name) DO UPDATE SET updated_at = students.updated_at
      RETURNING id, full_name, group_name
    ), enrolled AS (
      INSERT INTO subject_students (teacher_subject_id, student_id, subgroup)
      SELECT owned.id, saved.id, COALESCE(imported.subgroup, existing.subgroup, '')
      FROM owned CROSS JOIN saved
      JOIN imported ON imported."fullName" = saved.full_name AND imported."groupName" = saved.group_name
      LEFT JOIN subject_students existing ON existing.student_id = saved.id AND existing.teacher_subject_id = owned.id
      ON CONFLICT (teacher_subject_id, student_id) DO UPDATE SET subgroup = EXCLUDED.subgroup
      RETURNING id, student_id
    ), attached AS (
      INSERT INTO lesson_students (lesson_id, student_id)
      SELECT l.id, enrolled.student_id FROM enrolled CROSS JOIN lessons l
      WHERE l.id = ${lessonId}::BIGINT AND l.teacher_user_id = ${teacherUserId} AND l.roster_mode = 'selected'
      ON CONFLICT (lesson_id, student_id) DO NOTHING RETURNING student_id
    )
    SELECT id FROM enrolled
  ` as unknown as { id: string | number }[];
  return result.length === rows.length
    ? { success: true, message: `Опрацьовано студентів: ${result.length}. Повторні записи не дублюються.` }
    : { success: false, message: "Власне заняття або активний предмет не знайдено." };
}
