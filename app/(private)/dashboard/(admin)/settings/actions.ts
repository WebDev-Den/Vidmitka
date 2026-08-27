"use server";

import { revalidatePath } from "next/cache";

import { requireAdministrator } from "@/lib/auth/session";
import { saveScheduleWeekSettings } from "@/lib/schedule-week/repository";
import { endSemester } from "@/lib/semesters/repository";

import type { SemesterEndActionState, WeekSettingsActionState } from "./form-state";

export async function saveWeekSettingsAction(
  _previousState: WeekSettingsActionState,
  formData: FormData,
): Promise<WeekSettingsActionState> {
  await requireAdministrator();

  let result: WeekSettingsActionState;
  try {
    result = await saveScheduleWeekSettings({
      numeratorDate: formData.get("numeratorDate"),
    });
  } catch {
    return {
      success: false,
      message: "Не вдалося зберегти дату чисельника. Спробуйте ще раз.",
    };
  }

  if (result.success) {
    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard/schedule");
    revalidatePath("/dashboard/journal");
    revalidatePath("/schedule");
  }

  return result;
}

export async function endSemesterAction(
  _previousState: SemesterEndActionState,
): Promise<SemesterEndActionState> {
  const administrator = await requireAdministrator();
  const result = await endSemester(administrator.id);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/schedule");
  revalidatePath("/dashboard/journal");
  revalidatePath("/dashboard/my-lessons");
  revalidatePath("/schedule");

  return result;
}
