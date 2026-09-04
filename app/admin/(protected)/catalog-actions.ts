"use server";

import { revalidatePath } from "next/cache";

import { requireAdminPanelUser } from "@/lib/auth/session";
import {
  createScheduleCatalogEntry,
  deleteScheduleCatalogEntry,
  setScheduleCatalogEntryActive,
  updateScheduleCatalogEntry,
  updateScheduleCatalogEntries,
} from "@/lib/schedule-v2/catalogs";
import type { CatalogMutationResult, ScheduleCatalogKind } from "@/lib/schedule-v2/catalog-types";

function parseBatchChanges(formData: FormData): Array<{ id: string; name: string; color?: string }> | null {
  const raw = formData.get("changes");
  if (typeof raw !== "string") return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return null;
    return value.map((item) => {
      if (!item || typeof item !== "object") return { id: "", name: "" };
      const record = item as Record<string, unknown>;
      return {
        id: typeof record.id === "string" ? record.id : "",
        name: typeof record.name === "string" ? record.name : "",
        ...(typeof record.color === "string" ? { color: record.color } : {}),
      };
    });
  } catch {
    return null;
  }
}

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
  else if (operation === "batch-update") {
    const changes = parseBatchChanges(formData);
    result = changes ? await updateScheduleCatalogEntries(kind, changes) : { success: false, message: "Перелік змін некоректний." };
  }
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
