import "server-only";

import { getDb } from "@/lib/db";

import {
  REQUESTED_CALENDAR_OVERRIDES_2026,
  validateCalendarOverride,
  validateCalendarOverrideDateVersion,
  type CalendarDayContext,
  type CalendarOverride,
  type CalendarOverrideInput,
  type CalendarWeekType,
} from "./calendar-override-rules";

export type CalendarOverrideMutationResult = Readonly<{ success: boolean; message: string }>;
type MutationRow = { success: boolean; error: string | null };

export async function getCalendarDayContext(date: string): Promise<CalendarDayContext> {
  const parsed = validateCalendarOverrideDateVersion({ date, version: "0" });
  if (!parsed.ok) throw new Error("Некоректна дата розкладу.");
  const sql = getDb();
  const [row] = await sql`
    SELECT held_on::TEXT, calendar_day, schedule_day, week_type, is_makeup, context_token
    FROM get_schedule_day(${parsed.value.date}::DATE)
  ` as unknown as Array<{
    held_on: string;
    calendar_day: number;
    schedule_day: number;
    week_type: CalendarWeekType | null;
    is_makeup: boolean;
    context_token: string;
  }>;
  return {
    date: row.held_on,
    calendarDayOfWeek: Number(row.calendar_day),
    dayOfWeek: Number(row.schedule_day),
    weekType: row.week_type,
    isOverride: row.is_makeup,
    token: row.context_token,
  };
}

export async function listCalendarOverrides(): Promise<CalendarOverride[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT item.held_on::TEXT, item.schedule_day, item.week_type, item.version,
      EXISTS (SELECT 1 FROM attendance_sessions journal WHERE journal.held_on=item.held_on) AS has_journal
    FROM makeup_days item
    WHERE item.is_active
    ORDER BY item.held_on
  ` as unknown as Array<{
    held_on: string;
    schedule_day: number;
    week_type: CalendarWeekType;
    version: number;
    has_journal: boolean;
  }>;
  return rows.map((row) => ({
    date: row.held_on,
    dayOfWeek: Number(row.schedule_day),
    weekType: row.week_type,
    version: Number(row.version),
    hasJournal: row.has_journal,
  }));
}

export async function saveCalendarOverride(
  administratorId: string,
  input: CalendarOverrideInput,
): Promise<CalendarOverrideMutationResult> {
  const parsed = validateCalendarOverride(input);
  if (!parsed.ok) return { success: false, message: parsed.message };
  const { date, dayOfWeek, weekType, version } = parsed.value;
  const sql = getDb();
  const [, rows] = await sql.transaction([
    sql`SELECT lock_schedule_day(${date}::DATE)`,
    sql`
      WITH permission AS (
        SELECT CASE
          WHEN NOT EXISTS (
            SELECT 1 FROM app_users WHERE id=${administratorId}
              AND role='administrator' AND approval_status='approved'
          ) THEN 'Недостатньо прав для зміни календаря.'
          WHEN EXISTS (SELECT 1 FROM attendance_sessions WHERE held_on=${date}::DATE)
            THEN 'На цю дату вже збережено журнал. Змінювати перенесення не можна.'
          ELSE NULL END AS error
      ), changed AS (
        INSERT INTO makeup_days (
          held_on, schedule_day, week_type, created_by_user_id, updated_by_user_id
        )
        SELECT ${date}::DATE, ${dayOfWeek}, ${weekType}, ${administratorId}, ${administratorId}
        WHERE (SELECT error FROM permission) IS NULL
          AND (${version}=0 OR EXISTS (
            SELECT 1 FROM makeup_days
            WHERE held_on=${date}::DATE AND is_active AND version=${version}
          ))
        ON CONFLICT (held_on) DO UPDATE SET
          schedule_day=EXCLUDED.schedule_day,
          week_type=EXCLUDED.week_type,
          version=makeup_days.version+1,
          is_active=TRUE,
          updated_by_user_id=EXCLUDED.updated_by_user_id,
          updated_at=NOW()
        WHERE (${version}=0 AND NOT makeup_days.is_active)
          OR (${version}>0 AND makeup_days.is_active AND makeup_days.version=${version})
        RETURNING held_on
      )
      SELECT EXISTS (SELECT 1 FROM changed) AS success, error FROM permission
    `,
  ], { isolationLevel: "ReadCommitted" });
  const [result] = rows as unknown as MutationRow[];
  return {
    success: result.success,
    message: result.error ?? (result.success
      ? "Перенесення збережено. Для дати діє вибраний день і тип тижня."
      : "Запис уже існує або його змінив інший адміністратор. Оновіть сторінку."),
  };
}

export async function deleteCalendarOverride(
  administratorId: string,
  input: { date: FormDataEntryValue | null; version: FormDataEntryValue | null },
): Promise<CalendarOverrideMutationResult> {
  const parsed = validateCalendarOverrideDateVersion(input);
  if (!parsed.ok) return { success: false, message: parsed.message };
  const { date, version } = parsed.value;
  const sql = getDb();
  const [, rows] = await sql.transaction([
    sql`SELECT lock_schedule_day(${date}::DATE)`,
    sql`
      WITH permission AS (
        SELECT CASE
          WHEN NOT EXISTS (
            SELECT 1 FROM app_users WHERE id=${administratorId}
              AND role='administrator' AND approval_status='approved'
          ) THEN 'Недостатньо прав для зміни календаря.'
          WHEN EXISTS (SELECT 1 FROM attendance_sessions WHERE held_on=${date}::DATE)
            THEN 'На цю дату вже збережено журнал. Видалити перенесення не можна.'
          ELSE NULL END AS error
      ), changed AS (
        UPDATE makeup_days SET
          is_active=FALSE,
          version=version+1,
          updated_by_user_id=${administratorId},
          updated_at=NOW()
        WHERE held_on=${date}::DATE AND is_active AND version=${version}
          AND (SELECT error FROM permission) IS NULL
        RETURNING held_on
      )
      SELECT EXISTS (SELECT 1 FROM changed) AS success, error FROM permission
    `,
  ], { isolationLevel: "ReadCommitted" });
  const [result] = rows as unknown as MutationRow[];
  return {
    success: result.success,
    message: result.error ?? (result.success
      ? "Перенесення видалено. Для дати знову діє звичайний календар."
      : "Запис уже змінили або видалили. Оновіть сторінку."),
  };
}

export async function applyRequestedCalendarOverrides2026(
  administratorId: string,
): Promise<CalendarOverrideMutationResult> {
  const existing = new Map((await listCalendarOverrides()).map((item) => [item.date, item]));
  let unchanged = 0;
  const pending: Array<Promise<Readonly<{
    item: (typeof REQUESTED_CALENDAR_OVERRIDES_2026)[number];
    result: CalendarOverrideMutationResult;
  }>>> = [];

  for (const item of REQUESTED_CALENDAR_OVERRIDES_2026) {
    const current = existing.get(item.date);
    if (current?.dayOfWeek === item.dayOfWeek && current.weekType === item.weekType) {
      unchanged += 1;
      continue;
    }
    pending.push(saveCalendarOverride(administratorId, {
      date: item.date,
      dayOfWeek: String(item.dayOfWeek),
      weekType: item.weekType,
      version: String(current?.version ?? 0),
    }).then((result) => ({ item, result })));
  }

  const settled = await Promise.all(pending);
  const changed = settled.filter(({ result }) => result.success).length;
  const failures = settled
    .filter(({ result }) => !result.success)
    .map(({ item, result }) => `${item.date.split("-").reverse().join(".")}: ${result.message}`);

  if (failures.length) {
    return {
      success: false,
      message: `Збережено ${changed}, уже актуальні ${unchanged}. Не вдалося: ${failures.join(" ")}`,
    };
  }
  return {
    success: true,
    message: `Календар 2026 оновлено: збережено ${changed}, уже були актуальні ${unchanged}.`,
  };
}

export async function findImportedTemplateDate(input: {
  targetDate: string;
  dayOfWeek: number;
  weekType: CalendarWeekType;
}): Promise<string | null> {
  const sql = getDb();
  const [row] = await sql`
    SELECT source.original_date::TEXT AS template_date
    FROM (
      SELECT DISTINCT original_date
      FROM schedule_exceptions
      WHERE status='active' AND kind='one_time' AND source_kind='teacher_schedule_json'
    ) source
    CROSS JOIN LATERAL get_schedule_day(source.original_date) context
    WHERE context.calendar_day=${input.dayOfWeek}
      AND context.week_type=${input.weekType}
      AND NOT context.is_makeup
    ORDER BY ABS(source.original_date-${input.targetDate}::DATE), source.original_date
    LIMIT 1
  ` as unknown as Array<{ template_date: string }>;
  return row?.template_date ?? null;
}
