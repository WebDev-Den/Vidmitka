"use server";

import { revalidatePath } from "next/cache";

import { requireAdminPanelUser } from "@/lib/auth/session";
import {
  createScheduleCatalogEntry,
  deleteScheduleCatalogEntry,
  setScheduleCatalogEntryActive,
  updateScheduleCatalogEntry,
} from "@/lib/schedule-v2/catalogs";
import type { CatalogMutationResult, ScheduleCatalogKind } from "@/lib/schedule-v2/catalog-types";

export async function manageScheduleCatalogAction(
  kind: ScheduleCatalogKind,
  _previousState: CatalogMutationResult,
  formData: FormData,
): Promise<CatalogMutationResult> {
  await requireAdminPanelUser();
  const operation = formData.get("operation");
  const id = typeof formData.get("id") === "string" ? String(formData.get("id")) : "";
  let result: CatalogMutationResult;

  if (operation === "create") result = await createScheduleCatalogEntry(kind, formData);
  else if (operation === "update") result = await updateScheduleCatalogEntry(kind, id, formData);
  else if (operation === "activate" || operation === "deactivate") {
    result = await setScheduleCatalogEntryActive(kind, id, operation === "activate");
  } else if (operation === "delete") result = await deleteScheduleCatalogEntry(kind, id);
  else result = { success: false, message: "Невідома операція." };

  if (result.success) {
    revalidatePath(`/admin/${kind === "disciplines" ? "disciplines" : kind}`);
    revalidatePath("/admin/schedule");
    revalidatePath("/admin/import");
    revalidatePath("/");
    revalidatePath("/schedule");
  }
  return result;
}
