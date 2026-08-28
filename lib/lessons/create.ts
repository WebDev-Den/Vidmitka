import "server-only";
import { getDb } from "@/lib/db";
import { validateLessonDraft, type LessonInput } from "./rules";

export type CreateLessonResult = { success: boolean; message: string; lessonId?: string };
export async function createLesson(actorUserId: string, teacherUserId: string, input: LessonInput): Promise<CreateLessonResult> {
  const validation = validateLessonDraft(input);
  if (!validation.ok) return { success: false, message: validation.message };
  const draft = validation.value;
  const sql = getDb();
  try {
    const rows = await sql`
      WITH selected AS (
        SELECT id FROM students WHERE is_active
          AND id IN (SELECT value::BIGINT FROM JSONB_ARRAY_ELEMENTS_TEXT(${JSON.stringify(draft.studentIds)}::JSONB))
          AND group_name IN (SELECT value FROM JSONB_ARRAY_ELEMENTS_TEXT(${JSON.stringify(draft.groupNames)}::JSONB))
      ), valid AS (
        SELECT s.id AS subject_id, r.id AS room_id, p.id AS period_id, u.id AS teacher_id, t.id AS lesson_type_id
        FROM subjects s CROSS JOIN rooms r CROSS JOIN class_periods p CROSS JOIN app_users u CROSS JOIN lesson_types t
        WHERE s.id = ${draft.subjectId}::BIGINT AND s.is_active AND r.id = ${draft.roomId}::BIGINT AND r.is_active
          AND p.id = ${draft.classPeriodId}::BIGINT AND p.is_active
          AND t.id = ${draft.lessonTypeId}::BIGINT AND t.is_active
          AND u.id = ${teacherUserId} AND u.role IN ('teacher', 'administrator') AND u.approval_status = 'approved'
          AND (u.id = ${actorUserId} OR EXISTS (SELECT 1 FROM app_users actor WHERE actor.id = ${actorUserId}
            AND actor.role = 'administrator' AND actor.approval_status = 'approved'))
          AND (SELECT COUNT(*) FROM selected) = ${draft.studentIds.length}
          AND (SELECT COUNT(*) FROM student_groups WHERE name IN (
            SELECT value FROM JSONB_ARRAY_ELEMENTS_TEXT(${JSON.stringify(draft.groupNames)}::JSONB)
          )) = ${draft.groupNames.length}
      ), owned AS (
        INSERT INTO teacher_subjects (teacher_user_id, subject_id) SELECT teacher_id, subject_id FROM valid
        ON CONFLICT (teacher_user_id, subject_id) DO UPDATE SET teacher_user_id = EXCLUDED.teacher_user_id
        RETURNING id
      ), enrolled AS (
        INSERT INTO subject_students (teacher_subject_id, student_id)
        SELECT owned.id, selected.id FROM owned CROSS JOIN selected
        ON CONFLICT (teacher_subject_id, student_id) DO NOTHING RETURNING student_id
      ), created AS (
        INSERT INTO lessons (teacher_subject_id, teacher_user_id, room_id, class_period_id,
          day_of_week, week_type, created_by_user_id, roster_mode, lesson_type_id)
        SELECT owned.id, valid.teacher_id, valid.room_id, valid.period_id,
          ${draft.dayOfWeek}, ${draft.weekType}, ${actorUserId}, 'selected', valid.lesson_type_id
        FROM owned CROSS JOIN valid RETURNING id
      ), linked AS (
        INSERT INTO lesson_students (lesson_id, student_id)
        SELECT created.id, selected.id FROM created CROSS JOIN selected RETURNING lesson_id
      )
      SELECT id, (SELECT COUNT(*)::INT FROM linked) AS student_count FROM created
    ` as unknown as { id: string | number; student_count: number }[];
    return rows[0]
      ? { success: true, message: rows[0].student_count > 0
        ? `Заняття створено. Прив’язано студентів: ${rows[0].student_count}.`
        : "Заняття створено без студентів. Додайте їх пізніше в розділі «Мої заняття».", lessonId: String(rows[0].id) }
      : { success: false, message: "Перевірте активні довідники, викладача та належність студентів до вибраних груп. Дані могли змінитися — оновіть сторінку." };
  } catch (error) {
    const failure = error as { code?: string; constraint?: string };
    if (failure.code === "23P01") return { success: false, message: failure.constraint === "lessons_no_room_overlap"
      ? "Аудиторія вже зайнята в цей день, пару та тип тижня. Заняття не створено."
      : "Викладач уже має заняття в цей день, пару та тип тижня. Заняття не створено." };
    if (failure.code === "23503") return { success: false, message: "Довідники або список студентів змінилися. Оновіть сторінку." };
    throw error;
  }
}
