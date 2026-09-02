"use server";

import { revalidatePath } from "next/cache";

import { requireAdminPanelUser } from "@/lib/auth/session";
import { createScheduleEntry, deleteScheduleEntry, setScheduleEntryActive, updateScheduleEntry,
  type ScheduleEntryMutationResult } from "@/lib/schedule-v2/entries";

export async function manageScheduleEntryAction(
  _previousState: ScheduleEntryMutationResult,
  formData: FormData,
): Promise<ScheduleEntryMutationResult> {
  const administrator = await requireAdminPanelUser();
  const operation = formData.get("operation");
  const rawId = formData.get("id");
  const id = typeof rawId === "string" ? rawId : "";
  let result: ScheduleEntryMutationResult;

  if (operation === "create") result = await createScheduleEntry(administrator.id, formData);
  else if (operation === "update") result = await updateScheduleEntry(administrator.id, id, formData);
  else if (operation === "activate" || operation === "deactivate") {
    result = await setScheduleEntryActive(administrator.id, id, operation === "activate");
  } else if (operation === "delete") result = await deleteScheduleEntry(id);
  else result = { success: false, message: "Невідома операція." };

  if (result.success) {
    for (const path of ["/", "/schedule", "/admin", "/admin/schedule", "/admin/exceptions"]) revalidatePath(path);
  }
  return result;
}
