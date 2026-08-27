import "server-only";

import { getDb } from "@/lib/db";

export type SemesterEndResult = Readonly<{
  success: true;
  message: string;
  deletedLessons: number;
}>;

export async function endSemester(
  administratorUserId: string,
): Promise<SemesterEndResult> {
  const sql = getDb();
  const rows = (await sql`
    WITH deleted_lessons AS (
      DELETE FROM lessons
      RETURNING id
    )
    INSERT INTO semester_closures (
      closed_by_user_id,
      deleted_lesson_count
    )
    SELECT ${administratorUserId}, COUNT(*)::INTEGER
    FROM deleted_lessons
    RETURNING deleted_lesson_count
  `) as unknown as Array<{ deleted_lesson_count: number }>;
  const deletedLessons = rows[0]?.deleted_lesson_count ?? 0;

  return {
    success: true,
    deletedLessons,
    message: `Семестр завершено. Видалено занять: ${deletedLessons}. Студенти та їхні предмети збережені.`,
  };
}
