"use server";

import { revalidatePath } from "next/cache";

import { requireAdministrator } from "@/lib/auth/session";
import { saveScheduleWeekSettings } from "@/lib/schedule-week/repository";
import { endSemester } from "@/lib/semesters/repository";

export type WeekSettingsActionState = Readonly<{
  success: boolean;
  message: string;
}>;

export const initialWeekSettingsActionState: WeekSettingsActionState = {
  success: false,
  message: "",
};

export type SemesterEndActionState = Readonly<{
  success: boolean;
  message: string;
}>;

export const initialSemesterEndActionState: SemesterEndActionState = {
  success: false,
  message: "",
};

export async function saveWeekSettingsAction(
  _previousState: WeekSettingsActionState,
  formData: FormData,
): Promise<WeekSettingsActionState> {
  await requireAdministrator();

  const result = await saveScheduleWeekSettings({
    anchorDate: formData.get("anchorDate"),
    anchorWeekType: formData.get("anchorWeekType"),
  });

  if (result.success) {
    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard/schedule");
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
  revalidatePath("/schedule");

  return result;
}
