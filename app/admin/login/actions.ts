"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { authenticateAccount, clearAdminLoginThrottle, consumeAdminLoginPermit } from "@/lib/auth/repository";
import { isApprovedAdministrator } from "@/lib/auth/authorization";
import { startAppSession } from "@/lib/auth/session";
import { validateLoginForm } from "@/lib/auth/validation";

import type { AdminAuthActionState } from "./form-state";

const INVALID_CREDENTIALS = "Невірна електронна адреса або пароль адміністратора.";

export async function adminSignInAction(
  _previousState: AdminAuthActionState,
  formData: FormData,
): Promise<AdminAuthActionState> {
  const validation = validateLoginForm(formData);
  const email = typeof formData.get("email") === "string" ? String(formData.get("email")) : "";

  if (!validation.ok) {
    return {
      success: false,
      message: validation.message,
      fieldErrors: validation.fieldErrors,
      values: { email },
    };
  }

  const requestHeaders = await headers();
  const clientAddress = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const throttleKey = `${validation.value.email}|${clientAddress}`;
  if (!await consumeAdminLoginPermit(throttleKey)) {
    return { success: false, message: "Забагато спроб входу. Спробуйте через 15 хвилин.", fieldErrors: {}, values: { email } };
  }

  const result = await authenticateAccount(validation.value);
  if (
    !result.success ||
    !isApprovedAdministrator(result.user)
  ) {
    return { success: false, message: INVALID_CREDENTIALS, fieldErrors: {}, values: { email } };
  }

  await clearAdminLoginThrottle(throttleKey);
  await startAppSession(result.user.id);
  redirect("/admin");
}
