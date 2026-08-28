"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { approveTeacherAccount, changeAccountRole, type AccountRoleResult } from "@/lib/auth/repository";
import { requireAdministrator } from "@/lib/auth/session";

export async function approveTeacher(formData: FormData): Promise<void> {
  const administrator = await requireAdministrator();
  const userId = formData.get("userId");

  if (typeof userId !== "string" || userId.length === 0) {
    throw new Error("Не вказано обліковий запис викладача.");
  }

  const approved = await approveTeacherAccount(userId, administrator.id);
  if (!approved) throw new Error("Обліковий запис викладача не знайдено.");

  revalidatePath("/dashboard/teachers");
}

export async function changeRoleAction(
  _previous: AccountRoleResult,
  formData: FormData,
): Promise<AccountRoleResult> {
  const administrator = await requireAdministrator();
  const userId = formData.get("userId");
  const role = formData.get("role");
  if (typeof userId !== "string" || typeof role !== "string") {
    return { success: false, message: "Вкажіть користувача та роль." };
  }
  let result: AccountRoleResult;
  try {
    result = await changeAccountRole(administrator.id, userId, role);
  } catch {
    return { success: false, message: "Не вдалося змінити роль. Оновіть сторінку та повторіть спробу." };
  }
  if (result.success) {
    revalidatePath("/", "layout");
    if (userId === administrator.id && role === "teacher") redirect("/dashboard/journal");
  }
  return result;
}
