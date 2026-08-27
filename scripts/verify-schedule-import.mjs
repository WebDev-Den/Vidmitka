import { neon } from "@neondatabase/serverless";

const connectionString =
  process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

if (!connectionString) throw new Error("DATABASE_URL не налаштовано.");

const sql = neon(connectionString);
const suffix = Date.now().toString(36);
const teacherId = `__codex_import_teacher_${suffix}`;
const subjectNames = [`__codex_import_subject_a_${suffix}`, `__codex_import_subject_b_${suffix}`];
const roomNames = [`__codex_import_room_a_${suffix}`, `__codex_import_room_b_${suffix}`];

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
    SELECT id, number
    FROM class_periods
    WHERE is_active = TRUE
    ORDER BY number
    LIMIT 1
  `;
  if (!period) throw new Error("Немає активної пари для перевірки імпорту.");

  await sql`
    INSERT INTO subjects (name)
    VALUES (${subjectNames[0]}), (${subjectNames[1]})
  `;
  await sql`
    INSERT INTO rooms (name)
    VALUES (${roomNames[0]}), (${roomNames[1]})
  `;

  const subjects = await sql`
    SELECT id, name
    FROM subjects
    WHERE name IN (${subjectNames[0]}, ${subjectNames[1]})
  `;
  const rooms = await sql`
    SELECT id, name
    FROM rooms
    WHERE name IN (${roomNames[0]}, ${roomNames[1]})
  `;
  const subjectIdByName = new Map(subjects.map((subject) => [subject.name, subject.id]));
  const roomIdByName = new Map(rooms.map((room) => [room.name, room.id]));
  const rows = JSON.stringify([
    {
      subject_id: subjectIdByName.get(subjectNames[0]),
      room_id: roomIdByName.get(roomNames[0]),
      class_period_id: period.id,
      day_of_week: 1,
      week_type: "numerator",
    },
    {
      subject_id: subjectIdByName.get(subjectNames[1]),
      room_id: roomIdByName.get(roomNames[1]),
      class_period_id: period.id,
      day_of_week: 1,
      week_type: "denominator",
    },
  ]);

  const inserted = await sql`
    WITH imported AS (
      SELECT *
      FROM JSONB_TO_RECORDSET(${rows}::JSONB) AS item(
        subject_id BIGINT,
        room_id BIGINT,
        class_period_id BIGINT,
        day_of_week SMALLINT,
        week_type TEXT
      )
    ),
    validated AS (
      SELECT imported.*
      FROM imported
      JOIN subjects AS subject
        ON subject.id = imported.subject_id AND subject.is_active = TRUE
      JOIN rooms AS room
        ON room.id = imported.room_id AND room.is_active = TRUE
      JOIN class_periods AS period
        ON period.id = imported.class_period_id AND period.is_active = TRUE
    ),
    complete_import AS (
      SELECT
        (SELECT COUNT(1) FROM imported) =
        (SELECT COUNT(1) FROM validated) AS is_complete
    ),
    owned_subjects AS (
      INSERT INTO teacher_subjects (teacher_user_id, subject_id)
      SELECT DISTINCT ${teacherId}, validated.subject_id
      FROM validated
      CROSS JOIN complete_import
      WHERE complete_import.is_complete
      ON CONFLICT (teacher_user_id, subject_id) DO UPDATE
      SET teacher_user_id = EXCLUDED.teacher_user_id
      RETURNING id, subject_id
    )
    INSERT INTO lessons (
      teacher_subject_id,
      teacher_user_id,
      room_id,
      class_period_id,
      day_of_week,
      week_type,
      created_by_user_id
    )
    SELECT
      owned_subjects.id,
      ${teacherId},
      imported.room_id,
      imported.class_period_id,
      imported.day_of_week,
      imported.week_type,
      ${teacherId}
    FROM validated AS imported
    JOIN owned_subjects ON owned_subjects.subject_id = imported.subject_id
    CROSS JOIN complete_import
    WHERE complete_import.is_complete
    RETURNING id
  `;

  if (inserted.length !== 2) {
    throw new Error("Пакетний імпорт не створив обидва заняття.");
  }

  let conflictBlocked = false;
  try {
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
      SELECT
        teacher_subject.id,
        ${teacherId},
        room.id,
        ${period.id},
        1,
        'both',
        ${teacherId}
      FROM teacher_subjects AS teacher_subject
      JOIN subjects AS subject ON subject.id = teacher_subject.subject_id
      CROSS JOIN rooms AS room
      WHERE
        teacher_subject.teacher_user_id = ${teacherId}
        AND subject.name = ${subjectNames[0]}
        AND room.name = ${roomNames[0]}
    `;
  } catch (error) {
    conflictBlocked = error?.code === "23P01";
  }

  if (!conflictBlocked) {
    throw new Error("База даних не заблокувала конфлікт типу «обидва тижні». ");
  }
} finally {
  await sql`DELETE FROM lessons WHERE teacher_user_id = ${teacherId}`;
  await sql`DELETE FROM teacher_subjects WHERE teacher_user_id = ${teacherId}`;
  await sql`DELETE FROM app_users WHERE id = ${teacherId}`;
  await sql`
    DELETE FROM rooms WHERE name IN (${roomNames[0]}, ${roomNames[1]})
  `;
  await sql`
    DELETE FROM subjects WHERE name IN (${subjectNames[0]}, ${subjectNames[1]})
  `;
}

const [cleanup] = await sql`
  SELECT
    (SELECT COUNT(1)::INTEGER FROM lessons WHERE teacher_user_id = ${teacherId}) AS lessons,
    (SELECT COUNT(1)::INTEGER FROM teacher_subjects WHERE teacher_user_id = ${teacherId}) AS subjects
`;

if (cleanup.lessons !== 0 || cleanup.subjects !== 0) {
  throw new Error("Тимчасові дані перевірки імпорту не очищено.");
}

console.log(
  "Імпорт перевірено: пакет збережено, чисельник і знаменник сумісні, конфлікт «обидва тижні» заблоковано; тестові дані прибрано.",
);
