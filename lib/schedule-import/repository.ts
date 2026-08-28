import "server-only";

import { getDb } from "@/lib/db";

import type { ScheduleImportRow } from "./parser";

export type ScheduleImportResult = Readonly<{
  success: boolean;
  message: string;
  errors: string[];
  importedCount: number;
}>;

type ResolvedRow = {
  row_number: number;
  subject_name: string;
  room_name: string;
  period_number: number;
  subject_id: string | number | null;
  room_id: string | number | null;
  class_period_id: string | number | null;
  day_of_week: number;
  week_type: ScheduleImportRow["weekType"];
  lesson_type_name: string | null;
  lesson_type_id: string | number | null;
};

type ConflictRow = {
  row_number: number;
  teacher_conflict: boolean;
  room_conflict: boolean;
};

function inputJson(rows: ScheduleImportRow[]): string {
  return JSON.stringify(
    rows.map((row) => ({
      row_number: row.rowNumber,
      subject_name: row.subjectName,
      room_name: row.roomName,
      day_of_week: row.dayOfWeek,
      period_number: row.periodNumber,
      week_type: row.weekType,
      lesson_type_name: row.lessonTypeName ?? null,
    })),
  );
}

function referenceErrors(rows: ResolvedRow[]): string[] {
  return rows.flatMap((row) => {
    const errors: string[] = [];

    if (row.subject_id === null) {
      errors.push(
        `Рядок ${row.row_number}: активний предмет «${row.subject_name}» не знайдено.`,
      );
    }
    if (row.room_id === null) {
      errors.push(
        `Рядок ${row.row_number}: активну аудиторію «${row.room_name}» не знайдено.`,
      );
    }
    if (row.class_period_id === null) {
      errors.push(
        `Рядок ${row.row_number}: активну пару №${row.period_number} не знайдено.`,
      );
    }
    if (row.lesson_type_name !== null && row.lesson_type_id === null) {
      errors.push(`Рядок ${row.row_number}: активний тип заняття «${row.lesson_type_name}» не знайдено.`);
    }

    return errors;
  });
}

export async function importTeacherSchedule(
  teacherUserId: string,
  rows: ScheduleImportRow[],
): Promise<ScheduleImportResult> {
  if (rows.length === 0) {
    return {
      success: false,
      message: "Файл не містить занять.",
      errors: ["Додайте щонайменше одне заняття."],
      importedCount: 0,
    };
  }

  const sql = getDb();
  const serializedRows = inputJson(rows);
  const resolvedRows = (await sql`
    WITH imported AS (
      SELECT *
      FROM JSONB_TO_RECORDSET(${serializedRows}::JSONB) AS item(
        row_number INTEGER,
        subject_name TEXT,
        room_name TEXT,
        day_of_week SMALLINT,
        period_number SMALLINT,
        week_type TEXT,
        lesson_type_name TEXT
      )
    )
    SELECT
      imported.row_number,
      imported.subject_name,
      imported.room_name,
      imported.period_number,
      imported.day_of_week,
      imported.week_type,
      imported.lesson_type_name,
      lesson_type.id AS lesson_type_id,
      subject.id AS subject_id,
      room.id AS room_id,
      period.id AS class_period_id
    FROM imported
    LEFT JOIN subjects AS subject
      ON subject.name = imported.subject_name AND subject.is_active = TRUE
    LEFT JOIN rooms AS room
      ON room.name = imported.room_name AND room.is_active = TRUE
    LEFT JOIN class_periods AS period
      ON period.number = imported.period_number AND period.is_active = TRUE
    LEFT JOIN lesson_types AS lesson_type
      ON LOWER(lesson_type.name) = LOWER(imported.lesson_type_name) AND lesson_type.is_active
    ORDER BY imported.row_number
  `) as unknown as ResolvedRow[];
  const missingReferences = referenceErrors(resolvedRows);

  if (missingReferences.length > 0) {
    return {
      success: false,
      message: "Імпорт не виконано: виправте довідники або файл.",
      errors: missingReferences,
      importedCount: 0,
    };
  }

  const resolvedJson = JSON.stringify(resolvedRows);
  const conflicts = (await sql`
    WITH imported AS (
      SELECT *
      FROM JSONB_TO_RECORDSET(${resolvedJson}::JSONB) AS item(
        row_number INTEGER,
        subject_id BIGINT,
        room_id BIGINT,
        class_period_id BIGINT,
        day_of_week SMALLINT,
        week_type TEXT
      )
    )
    SELECT
      imported.row_number,
      BOOL_OR(lesson.teacher_user_id = ${teacherUserId}) AS teacher_conflict,
      BOOL_OR(lesson.room_id = imported.room_id) AS room_conflict
    FROM imported
    JOIN lessons AS lesson ON
      lesson.day_of_week = imported.day_of_week
      AND lesson.class_period_id = imported.class_period_id
      AND (
        lesson.week_type = 'both'
        OR imported.week_type = 'both'
        OR lesson.week_type = imported.week_type
      )
      AND (
        lesson.teacher_user_id = ${teacherUserId}
        OR lesson.room_id = imported.room_id
      )
    GROUP BY imported.row_number
    ORDER BY imported.row_number
  `) as unknown as ConflictRow[];

  if (conflicts.length > 0) {
    const errors = conflicts.map((conflict) => {
      const reason = conflict.teacher_conflict && conflict.room_conflict
        ? "викладач і аудиторія вже зайняті"
        : conflict.teacher_conflict
          ? "викладач уже має заняття"
          : "аудиторія вже зайнята";

      return `Рядок ${conflict.row_number}: ${reason} у цьому слоті.`;
    });

    return {
      success: false,
      message: "Імпорт не виконано через конфлікти розкладу.",
      errors,
      importedCount: 0,
    };
  }

  try {
    const inserted = (await sql`
      WITH imported AS (
        SELECT *
        FROM JSONB_TO_RECORDSET(${resolvedJson}::JSONB) AS item(
          row_number INTEGER,
          subject_id BIGINT,
          room_id BIGINT,
          class_period_id BIGINT,
          day_of_week SMALLINT,
          week_type TEXT,
          lesson_type_id BIGINT,
          lesson_type_name TEXT
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
        LEFT JOIN lesson_types AS lesson_type ON lesson_type.id = imported.lesson_type_id AND lesson_type.is_active
          AND LOWER(lesson_type.name) = LOWER(imported.lesson_type_name)
        WHERE imported.lesson_type_id IS NULL OR lesson_type.id IS NOT NULL
      ),
      complete_import AS (
        SELECT
          (SELECT COUNT(1) FROM imported) =
          (SELECT COUNT(1) FROM validated) AS is_complete
      ),
      owned_subjects AS (
        INSERT INTO teacher_subjects (teacher_user_id, subject_id)
        SELECT DISTINCT ${teacherUserId}, validated.subject_id
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
        created_by_user_id,
        lesson_type_id
      )
      SELECT
        owned_subjects.id,
        ${teacherUserId},
        imported.room_id,
        imported.class_period_id,
        imported.day_of_week,
        imported.week_type,
        ${teacherUserId},
        imported.lesson_type_id
      FROM validated AS imported
      JOIN owned_subjects ON owned_subjects.subject_id = imported.subject_id
      CROSS JOIN complete_import
      WHERE complete_import.is_complete
      RETURNING id
    `) as unknown as Array<{ id: string | number }>;

    if (inserted.length !== rows.length) {
      return {
        success: false,
        message: "Імпорт не виконано: один із довідників щойно змінився.",
        errors: ["Оновіть сторінку, перевірте активні значення та повторіть імпорт."],
        importedCount: 0,
      };
    }

    return {
      success: true,
      message: `Імпортовано занять: ${inserted.length}.`,
      errors: [],
      importedCount: inserted.length,
    };
  } catch (error) {
    if ((error as { code?: string }).code === "23P01") {
      return {
        success: false,
        message: "Імпорт не виконано: під час збереження виник конфлікт розкладу.",
        errors: ["Оновіть сторінку та перевірте, чи слот уже не зайнятий."],
        importedCount: 0,
      };
    }

    throw error;
  }
}
