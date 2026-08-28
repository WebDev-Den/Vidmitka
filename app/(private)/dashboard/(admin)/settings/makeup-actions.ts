"use server";

import { revalidatePath } from "next/cache";
import { requireAdministrator } from "@/lib/auth/session";
import { deleteMakeupDay, saveMakeupDay } from "@/lib/schedule-calendar/repository";
import type { MakeupActionState } from "./makeup-form-state";

function refreshCalendar() {
  for (const path of ["/", "/dashboard/settings", "/dashboard/schedule", "/dashboard/journal", "/schedule"]) {
    revalidatePath(path);
  }
}

export async function saveMakeupDayAction(_previous: MakeupActionState, form: FormData): Promise<MakeupActionState> {
  const administrator = await requireAdministrator();
  try {
    const result = await saveMakeupDay(administrator.id, {
      date: form.get("date"), dayOfWeek: form.get("dayOfWeek"),
      weekType: form.get("weekType"), version: form.get("version"),
    });
    if (result.success) refreshCalendar();
    return result;
  } catch {
    return { success: false, message: "Не вдалося зберегти відпрацювання. Оновіть календар перед повторною спробою." };
  }
}

export async function deleteMakeupDayAction(_previous: MakeupActionState, form: FormData): Promise<MakeupActionState> {
  const administrator = await requireAdministrator();
  try {
    const result = await deleteMakeupDay(administrator.id, { date: form.get("date"), version: form.get("version") });
    if (result.success) refreshCalendar();
    return result;
  } catch {
    return { success: false, message: "Не вдалося видалити відпрацювання. Оновіть календар перед повторною спробою." };
  }
}
