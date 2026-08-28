"use server";

import { revalidatePath } from "next/cache";
import { requireAppUser } from "@/lib/auth/session";
import { addLessonStudents } from "@/lib/lessons/roster";
import type { LessonActionState } from "../../../lessons/new/form-state";

export async function addLessonStudentsAction(_previous: LessonActionState, data: FormData): Promise<LessonActionState> {
  const actor = await requireAppUser();
  const lessonId = data.get("lessonId");
  if (typeof lessonId !== "string") return { success: false, message: "Оберіть заняття." };
  try {
    const result = await addLessonStudents(actor.id, lessonId, {
      groupNames: data.getAll("groupNames"), studentIds: data.getAll("studentIds"),
    });
    if (result.success) {
      for (const path of ["/dashboard/my-lessons", `/dashboard/my-lessons/${lessonId}/students`, "/dashboard/journal", "/dashboard/students"]) revalidatePath(path);
    }
    return result;
  } catch {
    return { success: false, message: "Не вдалося підтвердити додавання студентів. Оновіть список перед повторною спробою." };
  }
}
