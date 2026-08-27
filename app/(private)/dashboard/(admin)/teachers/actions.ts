"use server";

import { clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

import { resolveRole } from "@/lib/auth/roles";
import { requireAdministrator } from "@/lib/auth/session";

export async function approveTeacher(formData: FormData): Promise<void> {
  const administrator = await requireAdministrator();
  const userId = formData.get("userId");

  if (typeof userId !== "string" || userId.length === 0) {
    throw new Error("Не вказано обліковий запис викладача.");
  }

  const client = await clerkClient();
  const teacher = await client.users.getUser(userId);
  const primaryEmail = teacher.emailAddresses.find(
    (email) => email.id === teacher.primaryEmailAddressId,
  )?.emailAddress;

  if (!primaryEmail || resolveRole(primaryEmail) !== "teacher") {
    throw new Error("Схвалювати можна лише облікові записи викладачів.");
  }

  await client.users.updateUserMetadata(userId, {
    privateMetadata: {
      approved: true,
      approvedAt: new Date().toISOString(),
      approvedBy: administrator.id,
    },
  });

  revalidatePath("/dashboard/teachers");
}
