import { neon } from "@neondatabase/serverless";

const connectionString =
  process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

if (!connectionString) throw new Error("DATABASE_URL не налаштовано.");

const sql = neon(connectionString);
const suffix = Date.now().toString(36);
const subjectName = `__codex_subject_${suffix}`;
const roomName = `__codex_room_${suffix}`;
const teacherId = `__codex_teacher_${suffix}`;
const studentName = `Перевірочний Студент ${suffix}`;
const groupName = `TEST-${suffix}`;

async function addStudentAssignment() {
  return sql`
    WITH selected_subject AS (
      SELECT id
      FROM subjects
      WHERE name = ${subjectName} AND is_active = TRUE
    ),
    saved_student AS (
      INSERT INTO students (full_name, group_name)
      SELECT ${studentName}, ${groupName}
      FROM selected_subject
      ON CONFLICT (full_name, group_name) DO UPDATE
      SET updated_at = NOW()
      RETURNING id
    ),
    owned_subject AS (
      INSERT INTO teacher_subjects (teacher_user_id, subject_id)
      SELECT ${teacherId}, id
      FROM selected_subject
      ON CONFLICT (teacher_user_id, subject_id) DO UPDATE
      SET teacher_user_id = EXCLUDED.teacher_user_id
      RETURNING id
    )
    INSERT INTO subject_students (teacher_subject_id, student_id)
    SELECT owned_subject.id, saved_student.id
    FROM owned_subject
    CROSS JOIN saved_student
    ON CONFLICT (teacher_subject_id, student_id) DO NOTHING
    RETURNING id
  `;
}

try {
  await sql`
    INSERT INTO app_users (
      id, email, email_normalized, full_name, password_hash, role, approval_status
    )
    VALUES (
      ${teacherId},
      ${`${teacherId}@example.test`},
      ${`${teacherId}@example.test`},
      'Перевірочний Викладач',
      'test-only',
      'teacher',
      'approved'
    )
  `;

  const [period] = await sql`
    SELECT id
    FROM class_periods
    WHERE is_active = TRUE
    ORDER BY number
    LIMIT 1
  `;
  if (!period) throw new Error("Немає активної пари для перевірки.");

  await sql`INSERT INTO subjects (name) VALUES (${subjectName})`;
  await sql`INSERT INTO rooms (name) VALUES (${roomName})`;
  const firstAssignment = await addStudentAssignment();
  const duplicateAssignment = await addStudentAssignment();

  if (firstAssignment.length !== 1 || duplicateAssignment.length !== 0) {
    throw new Error("Додавання студента або захист від дублювання не працює.");
  }
  await sql`
    INSERT INTO lessons (
      teacher_subject_id,
      teacher_user_id,
      room_id,
      class_period_id,
      day_of_week,
      week_type,
      created_by_user_id
    )
    SELECT ts.id, ${teacherId}, r.id, ${period.id}, 1, 'numerator', ${teacherId}
    FROM teacher_subjects ts
    JOIN subjects s ON s.id = ts.subject_id
    CROSS JOIN rooms r
    WHERE
      ts.teacher_user_id = ${teacherId}
      AND s.name = ${subjectName}
      AND r.name = ${roomName}
  `;

  const [closure] = await sql`
    WITH blockers AS (
      SELECT 1
      FROM lessons
      WHERE created_by_user_id <> ${teacherId}
      LIMIT 1
    ),
    deleted_lessons AS (
      DELETE FROM lessons
      WHERE NOT EXISTS (SELECT 1 FROM blockers)
      RETURNING id
    )
    INSERT INTO semester_closures (
      closed_by_user_id,
      deleted_lesson_count
    )
    SELECT ${teacherId}, COUNT(*)::INTEGER
    FROM deleted_lessons
    WHERE NOT EXISTS (SELECT 1 FROM blockers)
    RETURNING deleted_lesson_count
  `;

  if (!closure || closure.deleted_lesson_count !== 1) {
    throw new Error(
      "Перевірку зупинено: у розкладі з'явилися сторонні заняття або тестове заняття не видалено.",
    );
  }

  const [preserved] = await sql`
    SELECT
      COUNT(DISTINCT st.id)::INTEGER AS students,
      COUNT(DISTINCT ss.id)::INTEGER AS enrollments
    FROM students st
    LEFT JOIN subject_students ss ON ss.student_id = st.id
    WHERE st.full_name = ${studentName} AND st.group_name = ${groupName}
  `;

  if (preserved?.students !== 1 || preserved?.enrollments !== 1) {
    throw new Error("Завершення семестру не зберегло студента або його предмет.");
  }

} finally {
  await sql`DELETE FROM lessons WHERE created_by_user_id = ${teacherId}`;
  await sql`DELETE FROM semester_closures WHERE closed_by_user_id = ${teacherId}`;
  await sql`
    DELETE FROM subject_students ss
    USING teacher_subjects ts
    WHERE ss.teacher_subject_id = ts.id AND ts.teacher_user_id = ${teacherId}
  `;
  await sql`DELETE FROM teacher_subjects WHERE teacher_user_id = ${teacherId}`;
  await sql`DELETE FROM app_users WHERE id = ${teacherId}`;
  await sql`
    DELETE FROM students
    WHERE full_name = ${studentName} AND group_name = ${groupName}
  `;
  await sql`DELETE FROM rooms WHERE name = ${roomName}`;
  await sql`DELETE FROM subjects WHERE name = ${subjectName}`;
}

const [cleanup] = await sql`
  SELECT
    (SELECT COUNT(1)::INTEGER FROM lessons WHERE created_by_user_id = ${teacherId}) AS lessons,
    (SELECT COUNT(1)::INTEGER FROM students WHERE full_name = ${studentName} AND group_name = ${groupName}) AS students,
    (SELECT COUNT(1)::INTEGER FROM semester_closures WHERE closed_by_user_id = ${teacherId}) AS closures
`;

if (cleanup.lessons !== 0 || cleanup.students !== 0 || cleanup.closures !== 0) {
  throw new Error("Тимчасові записи функціональної перевірки не очищено.");
}

console.log(
  "Перевірку пройдено: розклад очищено, студент і зв'язок із предметом збережено; тестові дані прибрано.",
);
