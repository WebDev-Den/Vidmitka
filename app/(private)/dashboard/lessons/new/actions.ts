"use server";
import { revalidatePath } from "next/cache";
import { requireAppUser } from "@/lib/auth/session";
import { createLesson } from "@/lib/lessons/create";
import type { LessonActionState } from "./form-state";

export async function createLessonAction(_previous: LessonActionState, data: FormData): Promise<LessonActionState> {
  const user = await requireAppUser();
  const requestedTeacher = data.get("teacherId");
  const teacherId = user.role === "teacher" ? user.id : typeof requestedTeacher === "string" ? requestedTeacher : "";
  if (!teacherId) return { success: false, message: "Оберіть викладача." };
  try {
    const result = await createLesson(user.id, teacherId, {
      subjectId: data.get("subjectId"), roomId: data.get("roomId"), classPeriodId: data.get("classPeriodId"),
      dayOfWeek: data.get("dayOfWeek"), weekType: data.get("weekType"),
      lessonTypeId: data.get("lessonTypeId"),
      groupNames: data.getAll("groupNames"), studentIds: data.getAll("studentIds"),
    });
    if (result.success) {
      for (const path of ["/", "/dashboard/lessons/new", "/dashboard/my-lessons", "/dashboard/journal", "/dashboard/students", "/dashboard/schedule", "/schedule"]) revalidatePath(path);
    }
    return result;
  } catch {
    return { success: false, message: "Не вдалося створити заняття. Перевірте з’єднання та повторіть спробу." };
  }
}
