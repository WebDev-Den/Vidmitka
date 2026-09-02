"use server";

import { revalidatePath } from "next/cache";

import { requireAdminPanelUser } from "@/lib/auth/session";
import { createScheduleException, deleteScheduleException, updateScheduleException,
  type ScheduleExceptionMutationResult } from "@/lib/schedule-v2/exceptions";

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
  if (result.success) for (const path of ["/", "/schedule", "/transfers", "/admin", "/admin/exceptions"]) revalidatePath(path);
  return result;
}
