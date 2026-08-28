import "server-only";
import { getDb } from "@/lib/db";
import type { DirectoryCreateResult } from "@/lib/lessons/directory-options";
import { validateLessonTypeName } from "./rules";

export type LessonType = Readonly<{ id: string; name: string; isActive: boolean }>;
export type LessonTypeResult = Readonly<{ success: boolean; message: string }>;

export async function listLessonTypes(options?: { activeOnly?: boolean }): Promise<LessonType[]> {
  const rows = await getDb()`SELECT id, name, is_active FROM lesson_types
    WHERE NOT ${options?.activeOnly ?? false} OR is_active ORDER BY name, id
  ` as unknown as { id: string | number; name: string; is_active: boolean }[];
  return rows.map((row) => ({ id: String(row.id), name: row.name, isActive: row.is_active }));
}

export async function saveLessonType(administratorId: string, input: { id?: string; name: unknown }): Promise<LessonTypeResult> {
  const { success, message } = await saveLessonTypeWithOption(administratorId, input);
  return { success, message };
}

export async function createLessonTypeOption(administratorId: string, name: unknown): Promise<DirectoryCreateResult> {
  return saveLessonTypeWithOption(administratorId, { name });
}

async function saveLessonTypeWithOption(administratorId: string, input: { id?: string; name: unknown }): Promise<DirectoryCreateResult> {
  const parsed = validateLessonTypeName(input.name);
  if (!parsed.ok) return { success: false, message: parsed.message };
  if (input.id !== undefined && !/^[1-9]\d{0,17}$/u.test(input.id)) return { success: false, message: "Некоректний тип заняття." };
  const sql = getDb();
  try {
    const rows = input.id === undefined ? await sql`
      INSERT INTO lesson_types (name) SELECT ${parsed.name}
      WHERE EXISTS (SELECT 1 FROM app_users WHERE id = ${administratorId}
        AND role = 'administrator' AND approval_status = 'approved') RETURNING id, name
    ` : await sql`
      UPDATE lesson_types SET name = ${parsed.name}, updated_at = NOW() WHERE id = ${input.id}::BIGINT
        AND EXISTS (SELECT 1 FROM app_users WHERE id = ${administratorId}
          AND role = 'administrator' AND approval_status = 'approved') RETURNING id, name
    `;
    const row = rows[0] as { id: string | number; name: string } | undefined;
    return row ? { success: true, message: input.id ? "Назву типу оновлено." : "Тип заняття додано.", option: { id: String(row.id), name: row.name } }
      : { success: false, message: "Тип не знайдено або недостатньо прав." };
  } catch (error) {
    if ((error as { code?: string }).code === "23505") return { success: false, message: "Тип заняття з такою назвою вже існує, зокрема серед неактивних." };
    throw error;
  }
}

export async function setLessonTypeActive(administratorId: string, id: string, active: boolean): Promise<LessonTypeResult> {
  if (!/^[1-9]\d{0,17}$/u.test(id) || typeof active !== "boolean") return { success: false, message: "Некоректні дані типу заняття." };
  const rows = await getDb()`UPDATE lesson_types SET is_active = ${active}, updated_at = NOW()
    WHERE id = ${id}::BIGINT AND EXISTS (SELECT 1 FROM app_users WHERE id = ${administratorId}
      AND role = 'administrator' AND approval_status = 'approved') RETURNING id
  `;
  return rows.length ? { success: true, message: active ? "Тип активовано." : "Тип деактивовано. Наявні заняття збережено." }
    : { success: false, message: "Тип не знайдено або недостатньо прав." };
}
