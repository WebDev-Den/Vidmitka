"use server";

import { revalidatePath } from "next/cache";
import { requireTeacher } from "@/lib/auth/session";
import { saveAttendance } from "@/lib/attendance/repository";
import { MAX_STUDENT_IMPORT_BYTES, parseStudentImport } from "@/lib/students/import-parser";
import { importTeacherStudents } from "@/lib/students/import-repository";
import type { JournalActionState, StudentImportState } from "./form-state";

export async function importStudentsAction(_previous: StudentImportState, data: FormData): Promise<StudentImportState> {
  const teacher = await requireTeacher();
  const file = data.get("studentsFile");
  if (!(file instanceof File) || !file.size) return { success: false, message: "Оберіть непорожній CSV або JSON.", errors: [] };
  if (file.size > MAX_STUDENT_IMPORT_BYTES) return { success: false, message: "Максимальний розмір файлу — 512 КБ.", errors: [] };
  const parsed = parseStudentImport(file.name, await file.text());
  if (!parsed.ok) return { success: false, message: "Імпорт не виконано. Виправте файл.", errors: parsed.errors };
  try {
    const lessonId = data.get("lessonId");
    const subjectId = data.get("subjectId");
    const target = typeof lessonId === "string" ? { lessonId } : { subjectId: typeof subjectId === "string" ? subjectId : "" };
    const result = await importTeacherStudents(teacher.id, target, parsed.rows);
    if (result.success) {
      revalidatePath("/dashboard/journal");
      revalidatePath("/dashboard/students");
      revalidatePath("/dashboard/lessons/new");
      revalidatePath("/dashboard/my-lessons");
    }
    return { ...result, errors: [] };
  } catch {
    return { success: false, message: "Не вдалося імпортувати студентів. Спробуйте ще раз.", errors: [] };
  }
}

export async function saveAttendanceAction(_previous: JournalActionState, data: FormData): Promise<JournalActionState> {
  const teacher = await requireTeacher();
  const date = data.get("date");
  const key = data.get("lessonKey");
  const serialized = data.get("marks");
  const rawVersion = data.get("version");
  if (typeof date !== "string" || typeof key !== "string" || typeof serialized !== "string"
    || serialized.length > 512 * 1024 || typeof rawVersion !== "string" || !/^\d{1,9}$/u.test(rawVersion)) {
    return { success: false, message: "Некоректні дані журналу." };
  }
  try {
    const result = await saveAttendance(teacher.id, { date, key, version: Number(rawVersion), marks: JSON.parse(serialized) });
    if (result.success) revalidatePath("/dashboard/journal");
    return result;
  } catch {
    return { success: false, message: "Не вдалося зберегти відмітки. Зміни залишаються у формі; спробуйте ще раз." };
  }
}
