"use server";

import { revalidatePath } from "next/cache";
import { requireAppUser } from "@/lib/auth/session";
import { setLessonTypeForLesson } from "@/lib/lessons/repository";
import type { LessonActionState } from "../lessons/new/form-state";

export async function updateLessonTypeAction(_previous: LessonActionState, data: FormData): Promise<LessonActionState> {
  const actor = await requireAppUser();
  const lessonId = data.get("lessonId");
  const typeId = data.get("lessonTypeId");
  if (typeof lessonId !== "string" || typeof typeId !== "string") return { success: false, message: "Оберіть тип заняття." };
  try {
    const result = await setLessonTypeForLesson(actor.id, lessonId, typeId);
    if (result.success) for (const path of ["/", "/schedule", "/dashboard/schedule", "/dashboard/my-lessons", "/dashboard/journal"]) revalidatePath(path);
    return result;
  } catch {
    return { success: false, message: "Не вдалося змінити тип заняття. Оновіть сторінку перед повторною спробою." };
  }
}
