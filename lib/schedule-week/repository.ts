import "server-only";

import { getDb } from "@/lib/db";

import {
  validateScheduleWeekSettings,
  type ScheduleWeekSettings,
} from "./rules";

export type ScheduleWeekSettingsResult = Readonly<{
  success: boolean;
  message: string;
}>;

export type ScheduleWeekConfiguration = ScheduleWeekSettings & Readonly<{
  semesterStart: string | null;
  semesterEnd: string | null;
}>;

type SettingsRow = {
  anchor_date: string;
  anchor_week_type: "numerator" | "denominator";
  semester_start?: string | null;
  semester_end?: string | null;
};

export async function getScheduleWeekSettings(): Promise<ScheduleWeekSettings | null> {
  const sql = getDb();
  const rows = (await sql`
    SELECT anchor_date::text AS anchor_date, anchor_week_type
    FROM schedule_week_settings
    WHERE id = 1
  `) as unknown as SettingsRow[];
  const settings = rows[0];

  if (!settings) return null;

  return {
    anchorDate: settings.anchor_date,
    anchorWeekType: settings.anchor_week_type,
  };
}

export async function getScheduleWeekConfiguration(): Promise<ScheduleWeekConfiguration | null> {
  const sql = getDb();
  const rows = await sql`
    SELECT anchor_date::text AS anchor_date, anchor_week_type,
      semester_start::text AS semester_start, semester_end::text AS semester_end
    FROM schedule_week_settings WHERE id=1
  ` as unknown as SettingsRow[];
  const settings = rows[0];
  return settings ? { anchorDate: settings.anchor_date, anchorWeekType: settings.anchor_week_type,
    semesterStart: settings.semester_start ?? null, semesterEnd: settings.semester_end ?? null } : null;
}

export async function saveScheduleWeekConfiguration(input: {
  anchorDate: FormDataEntryValue | null;
  anchorWeekType: FormDataEntryValue | null;
  semesterStart: FormDataEntryValue | null;
  semesterEnd: FormDataEntryValue | null;
}): Promise<ScheduleWeekSettingsResult> {
  const datePattern = /^\d{4}-\d{2}-\d{2}$/u;
  const value = (entry: FormDataEntryValue | null) => typeof entry === "string" ? entry.trim() : "";
  const anchorDate=value(input.anchorDate), anchorWeekType=value(input.anchorWeekType);
  const semesterStart=value(input.semesterStart) || null, semesterEnd=value(input.semesterEnd) || null;
  if (!datePattern.test(anchorDate) || !["numerator", "denominator"].includes(anchorWeekType)) {
    return { success: false, message: "Вкажіть базову дату та тип навчального тижня." };
  }
  if ((semesterStart && !datePattern.test(semesterStart)) || (semesterEnd && !datePattern.test(semesterEnd)) ||
      (semesterStart && semesterEnd && semesterEnd < semesterStart)) {
    return { success: false, message: "Перевірте дати початку й завершення семестру." };
  }
  const sql=getDb();
  await sql`INSERT INTO schedule_week_settings (id, anchor_date, anchor_week_type, semester_start, semester_end)
    VALUES (1, ${anchorDate}, ${anchorWeekType}, ${semesterStart}, ${semesterEnd})
    ON CONFLICT (id) DO UPDATE SET anchor_date=EXCLUDED.anchor_date, anchor_week_type=EXCLUDED.anchor_week_type,
      semester_start=EXCLUDED.semester_start, semester_end=EXCLUDED.semester_end, updated_at=NOW()`;
  return { success: true, message: "Налаштування навчальних тижнів збережено." };
}

export async function saveScheduleWeekSettings(input: {
  numeratorDate: FormDataEntryValue | null;
}): Promise<ScheduleWeekSettingsResult> {
  const validation = validateScheduleWeekSettings(input);
  if (!validation.ok) {
    return { success: false, message: validation.message };
  }

  const sql = getDb();
  const { anchorDate, anchorWeekType } = validation.value;

  await sql`
    INSERT INTO schedule_week_settings (id, anchor_date, anchor_week_type)
    VALUES (1, ${anchorDate}, ${anchorWeekType})
    ON CONFLICT (id) DO UPDATE
    SET
      anchor_date = EXCLUDED.anchor_date,
      anchor_week_type = EXCLUDED.anchor_week_type,
      updated_at = NOW()
  `;

  return {
    success: true,
    message: "Дату чисельника збережено. Наступні тижні чергуються автоматично.",
  };
}
