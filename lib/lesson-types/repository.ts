import "server-only";
import { getDb } from "@/lib/db";
import type { DirectoryCreateResult } from "@/lib/lessons/directory-options";
import { parseHexColor, type HexColor } from "@/lib/ui/colors";
import { DEFAULT_LESSON_TYPE_COLOR } from "./colors";
import { validateLessonTypeName } from "./rules";

export type LessonType = Readonly<{ id: string; name: string; color: HexColor; isActive: boolean }>;
export type LessonTypeResult = Readonly<{ success: boolean; message: string }>;

export async function listLessonTypes(options?: { activeOnly?: boolean }): Promise<LessonType[]> {
  const rows = await getDb()`SELECT id, name, color, is_active FROM lesson_types
    WHERE NOT ${options?.activeOnly ?? false} OR is_active ORDER BY name, id
  ` as unknown as { id: string | number; name: string; color: string; is_active: boolean }[];
  return rows.map((row) => ({ id: String(row.id), name: row.name,
    color: parseHexColor(row.color) ?? DEFAULT_LESSON_TYPE_COLOR, isActive: row.is_active }));
}

export async function saveLessonType(administratorId: string, input: { id?: string; name: unknown; color?: unknown }): Promise<LessonTypeResult> {
  const { success, message } = await saveLessonTypeWithOption(administratorId, input);
  return { success, message };
}

export async function createLessonTypeOption(administratorId: string, name: unknown): Promise<DirectoryCreateResult> {
  return saveLessonTypeWithOption(administratorId, { name });
}

async function saveLessonTypeWithOption(administratorId: string, input: { id?: string; name: unknown; color?: unknown }): Promise<DirectoryCreateResult> {
  const parsed = validateLessonTypeName(input.name);
  if (!parsed.ok) return { success: false, message: parsed.message };
  const color = parseHexColor(input.color);
  if (input.color !== undefined && color === null) {
    return { success: false, message: "Оберіть колір типу у форматі #RRGGBB." };
  }
  if (input.id !== undefined && !/^[1-9]\d{0,17}$/u.test(input.id)) return { success: false, message: "Некоректний тип заняття." };
  const sql = getDb();
  try {
    const rows = input.id === undefined ? await sql`
      INSERT INTO lesson_types (name, color) SELECT ${parsed.name}, ${color ?? DEFAULT_LESSON_TYPE_COLOR}
      WHERE EXISTS (SELECT 1 FROM app_users WHERE id = ${administratorId}
        AND role = 'administrator' AND approval_status = 'approved') RETURNING id, name
    ` : await sql`
      UPDATE lesson_types SET name = ${parsed.name}, color = COALESCE(${color}::TEXT, color), updated_at = NOW() WHERE id = ${input.id}::BIGINT
        AND EXISTS (SELECT 1 FROM app_users WHERE id = ${administratorId}
          AND role = 'administrator' AND approval_status = 'approved') RETURNING id, name
    `;
    const row = rows[0] as { id: string | number; name: string } | undefined;
    return row ? { success: true, message: input.id ? "Тип заняття оновлено." : "Тип заняття додано.", option: { id: String(row.id), name: row.name } }
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
