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

type SettingsRow = {
  anchor_date: string | Date;
  anchor_week_type: "numerator" | "denominator";
};

function normalizeDate(value: string | Date): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value.slice(0, 10);
}

export async function getScheduleWeekSettings(): Promise<ScheduleWeekSettings | null> {
  const sql = getDb();
  const rows = (await sql`
    SELECT anchor_date, anchor_week_type
    FROM schedule_week_settings
    WHERE id = 1
  `) as unknown as SettingsRow[];
  const settings = rows[0];

  if (!settings) return null;

  return {
    anchorDate: normalizeDate(settings.anchor_date),
    anchorWeekType: settings.anchor_week_type,
  };
}

export async function saveScheduleWeekSettings(input: {
  anchorDate: FormDataEntryValue | null;
  anchorWeekType: FormDataEntryValue | null;
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
    message: "Чергування чисельника і знаменника збережено.",
  };
}
