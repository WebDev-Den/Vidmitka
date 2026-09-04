"use server";

import { revalidatePath } from "next/cache";

import { requireAdminPanelUser } from "@/lib/auth/session";
import { initializeQStashSchedules } from "@/lib/public-push/qstash-schedules";

import type { CronActionState } from "./form-state";

export async function initializeQStashCronAction(
  _previous: CronActionState,
  _formData: FormData,
): Promise<CronActionState> {
  await requireAdminPanelUser();

  const result = await initializeQStashSchedules();
  if (result.success) {
    revalidatePath("/admin/cron");
  }

  return { ...result, submittedAt: Date.now() };
}
