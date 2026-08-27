"use server";

import { redirect } from "next/navigation";

import {
  authenticateAccount,
  registerAccount,
} from "@/lib/auth/repository";
import { endAppSession, startAppSession } from "@/lib/auth/session";
import {
  validateLoginForm,
  validateRegistrationForm,
} from "@/lib/auth/validation";

import type { AuthActionState } from "./form-state";

export async function signInAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const validation = validateLoginForm(formData);
  const email = typeof formData.get("email") === "string"
    ? String(formData.get("email"))
    : "";

  if (!validation.ok) {
    return {
      success: false,
      message: validation.message,
      fieldErrors: validation.fieldErrors,
      values: { email },
    };
  }

  const result = await authenticateAccount(validation.value);
  if (!result.success) {
    return {
      success: false,
      message: result.message,
      fieldErrors: {},
      values: { email },
    };
  }

  await startAppSession(result.user.id);
  redirect(
    result.user.approval === "approved" ? "/dashboard" : "/approval-pending",
  );
}

export async function signUpAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const validation = validateRegistrationForm(formData);
  const fullName = typeof formData.get("fullName") === "string"
    ? String(formData.get("fullName"))
    : "";
  const email = typeof formData.get("email") === "string"
    ? String(formData.get("email"))
    : "";

  if (!validation.ok) {
    return {
      success: false,
      message: validation.message,
      fieldErrors: validation.fieldErrors,
      values: { fullName, email },
    };
  }

  const result = await registerAccount(validation.value);
  if (!result.success) {
    return {
      success: false,
      message: result.message,
      fieldErrors: {},
      values: { fullName, email },
    };
  }

  await startAppSession(result.user.id);
  redirect(
    result.user.approval === "approved" ? "/dashboard" : "/approval-pending",
  );
}

export async function signOutAction(): Promise<void> {
  await endAppSession();
  redirect("/");
}
