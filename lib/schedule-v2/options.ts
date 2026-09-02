import "server-only";

import { getDb } from "@/lib/db";
import { listClassPeriods } from "@/lib/class-periods/repository";

export type ScheduleOption = Readonly<{ id: string; label: string }>;

export type ScheduleEditorOptions = Readonly<{
  groups: readonly ScheduleOption[];
  disciplines: readonly ScheduleOption[];
  lessonTypes: readonly ScheduleOption[];
  rooms: readonly ScheduleOption[];
  teachers: readonly ScheduleOption[];
  periods: readonly ScheduleOption[];
}>;

type OptionRow = { id: string; label: string };

export async function getScheduleEditorOptions(options?: { activeOnly?: boolean }): Promise<ScheduleEditorOptions> {
  const sql = getDb();
  const active = options?.activeOnly !== false;
  const [groups, disciplines, lessonTypes, rooms, teachers, periods] = await Promise.all([
    sql`SELECT id, code AS label FROM academic_groups WHERE (${active}=FALSE OR is_active) ORDER BY code` as unknown as Promise<OptionRow[]>,
    sql`SELECT id, name AS label FROM disciplines WHERE (${active}=FALSE OR is_active) ORDER BY name` as unknown as Promise<OptionRow[]>,
    sql`SELECT id, name AS label FROM schedule_lesson_types WHERE (${active}=FALSE OR is_active) ORDER BY name` as unknown as Promise<OptionRow[]>,
    sql`SELECT id, name AS label FROM schedule_rooms WHERE (${active}=FALSE OR is_active) ORDER BY name` as unknown as Promise<OptionRow[]>,
    sql`SELECT id, display_name AS label FROM teachers WHERE (${active}=FALSE OR is_active) ORDER BY display_name` as unknown as Promise<OptionRow[]>,
    listClassPeriods({ activeOnly: active }),
  ]);
  return {
    groups, disciplines, lessonTypes, rooms, teachers,
    periods: periods.map((period) => ({ id: period.id, label: period.label })),
  };
}
