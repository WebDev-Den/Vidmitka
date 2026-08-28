"use server";

import { revalidatePath } from "next/cache";
import { requireAdministrator } from "@/lib/auth/session";
import { createLessonTypeOption } from "@/lib/lesson-types/repository";
import { isLessonDirectoryKind, type DirectoryCreateResult } from "@/lib/lessons/directory-options";
import { createRoomOption } from "@/lib/rooms/repository";
import { createSubjectOption } from "@/lib/subjects/repository";

export async function createLessonDirectoryOption(kind: unknown, name: unknown): Promise<DirectoryCreateResult> {
  // Keep redirects outside the error boundary; every call must recheck the role.
  const administrator = await requireAdministrator();
  if (!isLessonDirectoryKind(kind) || typeof name !== "string") {
    return { success: false, message: "Некоректні дані довідника." };
  }

  try {
    const result = kind === "subject" ? await createSubjectOption(name)
      : kind === "room" ? await createRoomOption(name)
        : await createLessonTypeOption(administrator.id, name);
    if (result.success) {
      const directory = { subject: "subjects", room: "rooms", lessonType: "lesson-types" }[kind];
      revalidatePath(`/dashboard/${directory}`);
      revalidatePath("/dashboard/lessons/new");
      revalidatePath("/dashboard/import-schedule");
      if (kind === "subject") revalidatePath("/dashboard/students");
    }
    return result;
  } catch {
    return { success: false, message: "Не вдалося підтвердити додавання. Перевірте довідник перед повторною спробою. Дані заняття збережені у формі." };
  }
}
