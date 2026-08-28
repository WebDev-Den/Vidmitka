import "server-only";

import { getDb } from "@/lib/db";
import { validateScheduleWeekSettings } from "@/lib/schedule-week/rules";
import {
  validateMakeupDateVersion, validateMakeupDay,
  type MakeupDay, type MakeupDayInput, type PublicMakeupDay, type ScheduleDayContext,
} from "./rules";

export type CalendarMutationResult = Readonly<{ success: boolean; message: string }>;
type MutationRow = { success: boolean; error: string | null };

export async function getScheduleDayContext(date: string): Promise<ScheduleDayContext> {
  if (!validateScheduleWeekSettings({ numeratorDate: date }).ok) throw new Error("Некоректна дата розкладу.");
  const sql = getDb();
  const [row] = await sql`
    SELECT held_on::TEXT, calendar_day, schedule_day, week_type, is_makeup, context_token
    FROM get_schedule_day(${date}::DATE)
  ` as unknown as {
    held_on: string; calendar_day: number; schedule_day: number;
    week_type: ScheduleDayContext["weekType"]; is_makeup: boolean; context_token: string;
  }[];
  return { date: row.held_on, calendarDayOfWeek: row.calendar_day, dayOfWeek: row.schedule_day,
    weekType: row.week_type, isMakeup: row.is_makeup, token: row.context_token };
}

export async function listMakeupDays(): Promise<MakeupDay[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT m.held_on::TEXT, m.schedule_day, m.week_type, m.version,
      EXISTS (SELECT 1 FROM attendance_sessions a WHERE a.held_on = m.held_on) AS has_journal
    FROM makeup_days m WHERE m.is_active ORDER BY m.held_on
  ` as unknown as { held_on: string; schedule_day: number; week_type: MakeupDay["weekType"]; version: number; has_journal: boolean }[];
  return rows.map((row) => ({ date: row.held_on, dayOfWeek: row.schedule_day, weekType: row.week_type,
    version: row.version, hasJournal: row.has_journal }));
}

/** Public calendar projection: never read journal or administrative audit fields. */
export async function listPublicMakeupDays(): Promise<PublicMakeupDay[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT held_on::TEXT, schedule_day, week_type
    FROM makeup_days WHERE is_active ORDER BY held_on
  ` as unknown as { held_on: string; schedule_day: number; week_type: PublicMakeupDay["weekType"] }[];
  return rows.map((row) => ({ date: row.held_on, dayOfWeek: row.schedule_day, weekType: row.week_type }));
}

export async function saveMakeupDay(administratorId: string, input: MakeupDayInput): Promise<CalendarMutationResult> {
  const parsed = validateMakeupDay(input);
  if (!parsed.ok) return { success: false, message: parsed.message };
  const { date, dayOfWeek, weekType, version } = parsed.value;
  const sql = getDb();
  const [, rows] = await sql.transaction([
    sql`SELECT lock_schedule_day(${date}::DATE)`,
    sql`
      WITH permission AS (
        SELECT CASE
          WHEN NOT EXISTS (SELECT 1 FROM app_users WHERE id = ${administratorId}
            AND role = 'administrator' AND approval_status = 'approved')
            THEN 'Недостатньо прав для зміни календаря.'
          WHEN EXISTS (SELECT 1 FROM attendance_sessions WHERE held_on = ${date}::DATE)
            THEN 'На цю дату вже збережено журнал. Змінювати розклад відпрацювання не можна.'
          ELSE NULL END AS error
      ), changed AS (
        INSERT INTO makeup_days (held_on, schedule_day, week_type, created_by_user_id, updated_by_user_id)
        SELECT ${date}::DATE, ${dayOfWeek}, ${weekType}, ${administratorId}, ${administratorId}
        WHERE (SELECT error FROM permission) IS NULL
          AND (${version} = 0 OR EXISTS (SELECT 1 FROM makeup_days
            WHERE held_on = ${date}::DATE AND is_active AND version = ${version}))
        ON CONFLICT (held_on) DO UPDATE
        SET schedule_day = EXCLUDED.schedule_day, week_type = EXCLUDED.week_type,
          version = makeup_days.version + 1, is_active = TRUE,
          updated_by_user_id = EXCLUDED.updated_by_user_id, updated_at = NOW()
        WHERE (${version} = 0 AND NOT makeup_days.is_active)
          OR (${version} > 0 AND makeup_days.is_active AND makeup_days.version = ${version})
        RETURNING held_on
      )
      SELECT EXISTS (SELECT 1 FROM changed) AS success, error FROM permission
    `,
  ], { isolationLevel: "ReadCommitted" });
  const [result] = rows as unknown as MutationRow[];
  return { success: result.success, message: result.error ?? (result.success
    ? "Відпрацювання збережено. Розклад і журнал використовують вказаний день та тиждень."
    : "Дата вже додана або календар змінено іншим адміністратором. Оновіть сторінку.") };
}

export async function deleteMakeupDay(administratorId: string, input: {
  date: FormDataEntryValue | null; version: FormDataEntryValue | null;
}): Promise<CalendarMutationResult> {
  const parsed = validateMakeupDateVersion(input);
  if (!parsed.ok) return { success: false, message: parsed.message };
  const { date, version } = parsed.value;
  const sql = getDb();
  const [, rows] = await sql.transaction([
    sql`SELECT lock_schedule_day(${date}::DATE)`,
    sql`
      WITH permission AS (
        SELECT CASE
          WHEN NOT EXISTS (SELECT 1 FROM app_users WHERE id = ${administratorId}
            AND role = 'administrator' AND approval_status = 'approved')
            THEN 'Недостатньо прав для зміни календаря.'
          WHEN EXISTS (SELECT 1 FROM attendance_sessions WHERE held_on = ${date}::DATE)
            THEN 'На цю дату вже збережено журнал. Видалити відпрацювання не можна.'
          ELSE NULL END AS error
      ), changed AS (
        UPDATE makeup_days SET is_active = FALSE, version = version + 1,
          updated_by_user_id = ${administratorId}, updated_at = NOW()
        WHERE held_on = ${date}::DATE AND is_active AND version = ${version}
          AND (SELECT error FROM permission) IS NULL
        RETURNING held_on
      )
      SELECT EXISTS (SELECT 1 FROM changed) AS success, error FROM permission
    `,
  ], { isolationLevel: "ReadCommitted" });
  const [result] = rows as unknown as MutationRow[];
  return { success: result.success, message: result.error ?? (result.success
    ? "Відпрацювання видалено. Для дати знову діє звичайний розклад."
    : "Запис уже змінено або видалено. Оновіть сторінку.") };
}
