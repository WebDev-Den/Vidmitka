"use server";

import { revalidatePath } from "next/cache";

import { requireAdminPanelUser } from "@/lib/auth/session";
import { sendNextScheduledPush } from "@/lib/public-push/admin-operations";
import { isAdminPublicPushOperationsReady } from "@/lib/public-push/repository";
import { isUuid } from "@/lib/public-push/rules";
import { isWebPushConfigured } from "@/lib/public-push/sender";

import type { AdminPushActionState } from "./form-state";

export async function sendAdminPushAction(
  _previous: AdminPushActionState,
  formData: FormData,
): Promise<AdminPushActionState> {
  await requireAdminPanelUser();
  const value = formData.get("subscriptionId");
  const subscriptionId = typeof value === "string" ? value : "";
  if (!isUuid(subscriptionId)) return { success: false, message: "Некоректний ідентифікатор підписки." };

  try {
    if (!await isAdminPublicPushOperationsReady()) {
      return { success: false, message: "Журнал Push ще не підготовлено на сервері." };
    }
    if (!isWebPushConfigured()) {
      return { success: false, message: "Серверна конфігурація Push недоступна." };
    }

    const result = await sendNextScheduledPush(subscriptionId);
    revalidatePath("/admin/push");
    return { success: result.success, message: result.message };
  } catch {
    return { success: false, message: "Не вдалося виконати ручний запуск. Спробуйте пізніше." };
  }
}
