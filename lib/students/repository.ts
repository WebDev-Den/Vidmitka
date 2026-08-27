import "server-only";

import { getDb } from "@/lib/db";

import { validateStudentAssignment } from "./rules";
import { validateGroupSelection } from "@/lib/groups/rules";

export type TeacherStudent = Readonly<{
  enrollmentId: string;
  studentId: string;
  fullName: string;
  groupName: string;
  subgroup: string;
  subjectId: string;
  subjectName: string;
}>;

export type StudentMutationResult = Readonly<{
  success: boolean;
  message: string;
}>;

type TeacherStudentRow = {
  enrollment_id: string | number;
  student_id: string | number;
  full_name: string;
  group_name: string;
  subgroup: string;
  subject_id: string | number;
  subject_name: string;
};

export async function listTeacherStudents(
  teacherUserId: string,
): Promise<TeacherStudent[]> {
  const sql = getDb();
  const rows = (await sql`
    SELECT
      ss.id AS enrollment_id,
      st.id AS student_id,
      st.full_name,
      st.group_name,
      ss.subgroup,
      s.id AS subject_id,
      s.name AS subject_name
    FROM subject_students ss
    JOIN students st ON st.id = ss.student_id
    JOIN teacher_subjects ts ON ts.id = ss.teacher_subject_id
    JOIN subjects s ON s.id = ts.subject_id
    WHERE ts.teacher_user_id = ${teacherUserId}
    ORDER BY s.name ASC, st.full_name ASC
  `) as unknown as TeacherStudentRow[];

  return rows.map((row) => ({
    enrollmentId: String(row.enrollment_id),
    studentId: String(row.student_id),
    fullName: row.full_name,
    groupName: row.group_name,
    subgroup: row.subgroup,
    subjectId: String(row.subject_id),
    subjectName: row.subject_name,
  }));
}

export async function addStudentToTeacherSubject(input: {
  teacherUserId: string;
  fullName: FormDataEntryValue | null;
  groupMode: FormDataEntryValue | null;
  existingGroupName: FormDataEntryValue | null;
  newGroupName: FormDataEntryValue | null;
  subjectId: FormDataEntryValue | null;
  subgroup?: FormDataEntryValue | null;
}): Promise<StudentMutationResult> {
  const group = validateGroupSelection({ mode: input.groupMode, existingName: input.existingGroupName, newName: input.newGroupName });
  if (!group.ok) return { success: false, message: group.message };
  const validation = validateStudentAssignment({ ...input, groupName: group.name });
  if (!validation.ok) {
    return { success: false, message: validation.message };
  }

  const { fullName, groupName, subjectId } = validation.value;
  const subgroup = typeof input.subgroup === "string" ? input.subgroup.trim().replace(/\s+/gu, " ") : "";
  if (subgroup.length > 100) return { success: false, message: "Підгрупа має містити до 100 символів." };
  const sql = getDb();

  try {
    const rows = (await sql`
      WITH selected_subject AS (
        SELECT id
        FROM subjects
        WHERE id = ${subjectId} AND is_active = TRUE
          AND (NOT ${group.mustExist} OR EXISTS (SELECT 1 FROM student_groups WHERE name = ${groupName}))
      ),
      saved_student AS (
        INSERT INTO students (full_name, group_name)
        SELECT ${fullName}, ${groupName}
        FROM selected_subject
        ON CONFLICT (full_name, group_name) DO UPDATE
        SET updated_at = NOW()
        RETURNING id
      ),
      owned_subject AS (
        INSERT INTO teacher_subjects (teacher_user_id, subject_id)
        SELECT ${input.teacherUserId}, id
        FROM selected_subject
        ON CONFLICT (teacher_user_id, subject_id) DO UPDATE
        SET teacher_user_id = EXCLUDED.teacher_user_id
        RETURNING id
      )
      INSERT INTO subject_students (teacher_subject_id, student_id, subgroup)
      SELECT owned_subject.id, saved_student.id, ${subgroup}
      FROM owned_subject
      CROSS JOIN saved_student
      ON CONFLICT (teacher_subject_id, student_id) DO NOTHING
      RETURNING id
    `) as unknown as Array<{ id: string | number }>;

    if (rows.length === 0) {
      const [subject] = (await sql`
        SELECT id FROM subjects WHERE id = ${subjectId} AND is_active = TRUE
      `) as unknown as Array<{ id: string | number }>;

      return subject
        ? { success: false, message: "Студент уже доданий до предмета або вибрану групу не знайдено." }
        : { success: false, message: "Активний предмет не знайдено." };
    }
  } catch (error) {
    if ((error as { code?: string }).code === "23503") {
      return { success: false, message: "Активний предмет не знайдено." };
    }
    throw error;
  }

  return {
    success: true,
    message: `${fullName} додано до предмета.`,
  };
}

export async function removeStudentFromTeacherSubject(
  teacherUserId: string,
  enrollmentId: string,
): Promise<StudentMutationResult> {
  if (!/^\d+$/u.test(enrollmentId)) {
    return { success: false, message: "Некоректний зв’язок зі студентом." };
  }

  const sql = getDb();
  const rows = (await sql`
    DELETE FROM subject_students ss
    USING teacher_subjects ts
    WHERE
      ss.id = ${enrollmentId}
      AND ss.teacher_subject_id = ts.id
      AND ts.teacher_user_id = ${teacherUserId}
    RETURNING ss.id
  `) as unknown as Array<{ id: string | number }>;

  return rows[0]
    ? {
        success: true,
        message: "Студента прибрано з предмета. Запис студента збережено.",
      }
    : { success: false, message: "Зв’язок зі студентом не знайдено." };
}
