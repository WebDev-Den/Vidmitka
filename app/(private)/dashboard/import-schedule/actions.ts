"use server";

import { revalidatePath } from "next/cache";

import { requireTeacher } from "@/lib/auth/session";
import { parseScheduleImport } from "@/lib/schedule-import/parser";
import { importTeacherSchedule } from "@/lib/schedule-import/repository";

export type ImportScheduleActionState = Readonly<{
  success: boolean;
  message: string;
  errors: string[];
  importedCount: number;
}>;

export const initialImportScheduleActionState: ImportScheduleActionState = {
  success: false,
  message: "",
  errors: [],
  importedCount: 0,
};

const MAX_FILE_SIZE_BYTES = 512 * 1024;
const MAX_RETURNED_ERRORS = 20;

function failed(message: string, errors: string[] = []): ImportScheduleActionState {
  const visibleErrors = errors.slice(0, MAX_RETURNED_ERRORS);
  if (errors.length > MAX_RETURNED_ERRORS) {
    visibleErrors.push(`Не показано ще помилок: ${errors.length - MAX_RETURNED_ERRORS}.`);
  }

  return { success: false, message, errors: visibleErrors, importedCount: 0 };
}

export async function importScheduleAction(
  _previousState: ImportScheduleActionState,
  formData: FormData,
): Promise<ImportScheduleActionState> {
  const teacher = await requireTeacher();
  const file = formData.get("scheduleFile");

  if (!(file instanceof File) || file.size === 0) {
    return failed("Оберіть непорожній файл JSON або CSV.");
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return failed("Файл завеликий. Максимальний розмір — 512 КБ.");
  }

  const parsed = parseScheduleImport({
    fileName: file.name,
    content: await file.text(),
  });

  if (!parsed.ok) {
    return failed("Імпорт не виконано: виправте помилки у файлі.", parsed.errors);
  }

  const result = await importTeacherSchedule(teacher.id, parsed.rows);
  if (result.success) {
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/my-lessons");
    revalidatePath("/dashboard/journal");
    revalidatePath("/dashboard/schedule");
    revalidatePath("/schedule");
  }

  return result.success ? result : failed(result.message, result.errors);
}
