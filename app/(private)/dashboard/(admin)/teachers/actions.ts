"use server";

import { revalidatePath } from "next/cache";

import { approveTeacherAccount } from "@/lib/auth/repository";
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
