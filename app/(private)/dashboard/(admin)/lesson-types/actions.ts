"use server";

import { revalidatePath } from "next/cache";
import { requireAdministrator } from "@/lib/auth/session";
import { saveLessonType, setLessonTypeActive } from "@/lib/lesson-types/repository";
import type { LessonTypeActionState } from "./form-state";

function refreshTypes() {
  for (const path of ["/", "/dashboard/lesson-types", "/dashboard/lessons/new", "/dashboard/import-schedule", "/dashboard/my-lessons", "/dashboard/journal", "/dashboard/schedule", "/schedule"]) revalidatePath(path);
}

export async function saveLessonTypeAction(_previous: LessonTypeActionState, data: FormData): Promise<LessonTypeActionState> {
  const administrator = await requireAdministrator();
  const id = data.get("id");
  if (id !== null && typeof id !== "string") return { success: false, message: "Некоректний тип заняття." };
  try {
    const result = await saveLessonType(administrator.id, {
      id: id ?? undefined, name: data.get("name"), color: data.get("color") ?? undefined,
    });
    if (result.success) refreshTypes();
    return result;
  } catch {
    return { success: false, message: "Не вдалося зберегти тип. Оновіть сторінку перед повторною спробою." };
  }
}

export async function toggleLessonTypeAction(_previous: LessonTypeActionState, data: FormData): Promise<LessonTypeActionState> {
  const administrator = await requireAdministrator();
  const id = data.get("id");
  const active = data.get("active");
  if (typeof id !== "string" || (active !== "true" && active !== "false")) return { success: false, message: "Некоректні дані типу заняття." };
  try {
    const result = await setLessonTypeActive(administrator.id, id, active === "true");
    if (result.success) refreshTypes();
    return result;
  } catch {
    return { success: false, message: "Не вдалося змінити стан типу. Оновіть сторінку." };
  }
}
