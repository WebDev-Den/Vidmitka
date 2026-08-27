import type { CreateLessonResult } from "@/lib/lessons/create";
export type LessonActionState = CreateLessonResult;
export const initialLessonState: LessonActionState = { success: false, message: "" };
