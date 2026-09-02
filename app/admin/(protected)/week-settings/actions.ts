"use server";

import { revalidatePath } from "next/cache";

import { requireAdminPanelUser } from "@/lib/auth/session";
import { saveScheduleWeekConfiguration, type ScheduleWeekSettingsResult } from "@/lib/schedule-week/repository";

export async function saveWeekConfigurationAction(_previous: ScheduleWeekSettingsResult, formData: FormData): Promise<ScheduleWeekSettingsResult> {
  await requireAdminPanelUser();
  const result = await saveScheduleWeekConfiguration({ anchorDate: formData.get("anchorDate"), anchorWeekType: formData.get("anchorWeekType"),
    semesterStart: formData.get("semesterStart"), semesterEnd: formData.get("semesterEnd") });
  if (result.success) for (const path of ["/", "/schedule", "/admin", "/admin/week-settings"]) revalidatePath(path);
  return result;
}
