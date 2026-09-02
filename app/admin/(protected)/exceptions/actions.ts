"use server";

import { revalidatePath } from "next/cache";

import { requireAdminPanelUser } from "@/lib/auth/session";
import {
  applyRequestedCalendarOverrides2026,
  deleteCalendarOverride,
  saveCalendarOverride,
  type CalendarOverrideMutationResult,
} from "@/lib/schedule-v2/calendar-overrides";
import { createScheduleException, deleteScheduleException, updateScheduleException,
  type ScheduleExceptionMutationResult } from "@/lib/schedule-v2/exceptions";

const AFFECTED_PATHS = ["/", "/schedule", "/transfers", "/admin", "/admin/exceptions"] as const;

function revalidateSchedulePaths() {
  for (const path of AFFECTED_PATHS) revalidatePath(path);
}

export async function manageScheduleExceptionAction(
  _previousState: ScheduleExceptionMutationResult,
  formData: FormData,
): Promise<ScheduleExceptionMutationResult> {
  const administrator = await requireAdminPanelUser();
  const operation = formData.get("operation");
  const value = formData.get("id");
  const id = typeof value === "string" ? value : "";
  let result: ScheduleExceptionMutationResult;
  if (operation === "create") result = await createScheduleException(administrator.id, formData);
  else if (operation === "update") result = await updateScheduleException(administrator.id, id, formData);
  else if (operation === "delete") result = await deleteScheduleException(id);
  else result = { success: false, message: "Невідома операція." };
  if (result.success) revalidateSchedulePaths();
  return result;
}

export async function manageCalendarOverrideAction(
  _previousState: CalendarOverrideMutationResult,
  formData: FormData,
): Promise<CalendarOverrideMutationResult> {
  const administrator = await requireAdminPanelUser();
  const operation = formData.get("operation");
  let result: CalendarOverrideMutationResult;
  if (operation === "save-calendar-override") {
    result = await saveCalendarOverride(administrator.id, {
      date: formData.get("date"),
      dayOfWeek: formData.get("dayOfWeek"),
      weekType: formData.get("weekType"),
      version: formData.get("version"),
    });
  } else if (operation === "delete-calendar-override") {
    result = await deleteCalendarOverride(administrator.id, {
      date: formData.get("date"),
      version: formData.get("version"),
    });
  } else if (operation === "apply-requested-calendar-2026") {
    result = await applyRequestedCalendarOverrides2026(administrator.id);
  } else {
    result = { success: false, message: "Невідома операція з календарем." };
  }
  revalidateSchedulePaths();
  return result;
}
