import "server-only";

import { getDb } from "@/lib/db";
import { parseHexColor } from "@/lib/ui/colors";

import type { CatalogMutationResult, ScheduleCatalogEntry, ScheduleCatalogKind } from "./catalog-types";

type CatalogRow = { id: string; name: string; is_active: boolean; color?: string };
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function normalize(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.normalize("NFC").trim().replace(/\s+/gu, " ") : "";
}

function normalizedKey(value: string): string {
  return value.toLocaleLowerCase("uk-UA");
}

function validName(kind: ScheduleCatalogKind, name: string): boolean {
  const [minimum, maximum] = kind === "groups" || kind === "rooms"
    ? [1, kind === "groups" ? 100 : 120]
    : [2, kind === "disciplines" ? 300 : 200];
  return name.length >= minimum && name.length <= maximum;
}

function fromRows(rows: CatalogRow[]): ScheduleCatalogEntry[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    isActive: row.is_active,
    ...(row.color && parseHexColor(row.color) ? { color: parseHexColor(row.color)! } : {}),
  }));
}

export async function listScheduleCatalog(kind: ScheduleCatalogKind): Promise<ScheduleCatalogEntry[]> {
  const sql = getDb();
  switch (kind) {
    case "groups": return fromRows(await sql`SELECT id, code AS name, is_active FROM academic_groups ORDER BY code` as unknown as CatalogRow[]);
    case "disciplines": return fromRows(await sql`SELECT id, name, is_active FROM disciplines ORDER BY name` as unknown as CatalogRow[]);
    case "rooms": return fromRows(await sql`SELECT id, name, is_active FROM schedule_rooms ORDER BY name` as unknown as CatalogRow[]);
    case "teachers": return fromRows(await sql`SELECT id, display_name AS name, is_active FROM teachers ORDER BY display_name` as unknown as CatalogRow[]);
    case "lesson-types": return fromRows(await sql`SELECT id, name, is_active, color FROM schedule_lesson_types ORDER BY name` as unknown as CatalogRow[]);
  }
}

export async function createScheduleCatalogEntry(kind: ScheduleCatalogKind, formData: FormData): Promise<CatalogMutationResult> {
  const name = normalize(formData.get("name"));
  if (!validName(kind, name)) return { success: false, message: "Перевірте довжину та заповнення назви." };
  const nameKey = normalizedKey(name);
  const color = kind === "lesson-types" ? parseHexColor(formData.get("color")) : null;
  if (kind === "lesson-types" && !color) return { success: false, message: "Оберіть коректний колір типу заняття." };
  const sql = getDb();

  try {
    switch (kind) {
      case "groups": await sql`INSERT INTO academic_groups (code, code_normalized) VALUES (${name}, ${nameKey})`; break;
      case "disciplines": await sql`INSERT INTO disciplines (name, name_normalized) VALUES (${name}, ${nameKey})`; break;
      case "rooms": await sql`INSERT INTO schedule_rooms (name, name_normalized) VALUES (${name}, ${nameKey})`; break;
      case "teachers": await sql`INSERT INTO teachers (display_name, display_name_normalized) VALUES (${name}, ${nameKey})`; break;
      case "lesson-types": await sql`INSERT INTO schedule_lesson_types (name, name_normalized, color) VALUES (${name}, ${nameKey}, ${color})`; break;
    }
    return { success: true, message: `Запис «${name}» додано.` };
  } catch (error) {
    if ((error as { code?: string }).code === "23505") return { success: false, message: "Запис із такою назвою вже існує." };
    throw error;
  }
}

export async function updateScheduleCatalogEntry(kind: ScheduleCatalogKind, id: string, formData: FormData): Promise<CatalogMutationResult> {
  if (!UUID_PATTERN.test(id)) return { success: false, message: "Некоректний ідентифікатор запису." };
  const name = normalize(formData.get("name"));
  if (!validName(kind, name)) return { success: false, message: "Перевірте довжину та заповнення назви." };
  const nameKey = normalizedKey(name);
  const color = kind === "lesson-types" ? parseHexColor(formData.get("color")) : null;
  if (kind === "lesson-types" && !color) return { success: false, message: "Оберіть коректний колір типу заняття." };
  const sql = getDb();

  try {
    let rows: Array<{ id: string }> = [];
    switch (kind) {
      case "groups": rows = await sql`UPDATE academic_groups SET code=${name}, code_normalized=${nameKey}, updated_at=NOW() WHERE id=${id} RETURNING id` as unknown as Array<{id:string}>; break;
      case "disciplines": rows = await sql`UPDATE disciplines SET name=${name}, name_normalized=${nameKey}, updated_at=NOW() WHERE id=${id} RETURNING id` as unknown as Array<{id:string}>; break;
      case "rooms": rows = await sql`UPDATE schedule_rooms SET name=${name}, name_normalized=${nameKey}, updated_at=NOW() WHERE id=${id} RETURNING id` as unknown as Array<{id:string}>; break;
      case "teachers": rows = await sql`UPDATE teachers SET display_name=${name}, display_name_normalized=${nameKey}, updated_at=NOW() WHERE id=${id} RETURNING id` as unknown as Array<{id:string}>; break;
      case "lesson-types": rows = await sql`UPDATE schedule_lesson_types SET name=${name}, name_normalized=${nameKey}, color=${color}, updated_at=NOW() WHERE id=${id} RETURNING id` as unknown as Array<{id:string}>; break;
    }
    return rows.length ? { success: true, message: `Запис «${name}» оновлено.` } : { success: false, message: "Запис не знайдено." };
  } catch (error) {
    if ((error as { code?: string }).code === "23505") return { success: false, message: "Запис із такою назвою вже існує." };
    throw error;
  }
}

export async function setScheduleCatalogEntryActive(kind: ScheduleCatalogKind, id: string, active: boolean): Promise<CatalogMutationResult> {
  if (!UUID_PATTERN.test(id)) return { success: false, message: "Некоректний ідентифікатор запису." };
  const sql = getDb();
  let rows: Array<{ name: string }> = [];
  switch (kind) {
    case "groups": rows = await sql`UPDATE academic_groups SET is_active=${active}, updated_at=NOW() WHERE id=${id} RETURNING code AS name` as unknown as Array<{name:string}>; break;
    case "disciplines": rows = await sql`UPDATE disciplines SET is_active=${active}, updated_at=NOW() WHERE id=${id} RETURNING name` as unknown as Array<{name:string}>; break;
    case "rooms": rows = await sql`UPDATE schedule_rooms SET is_active=${active}, updated_at=NOW() WHERE id=${id} RETURNING name` as unknown as Array<{name:string}>; break;
    case "teachers": rows = await sql`UPDATE teachers SET is_active=${active}, updated_at=NOW() WHERE id=${id} RETURNING display_name AS name` as unknown as Array<{name:string}>; break;
    case "lesson-types": rows = await sql`UPDATE schedule_lesson_types SET is_active=${active}, updated_at=NOW() WHERE id=${id} RETURNING name` as unknown as Array<{name:string}>; break;
  }
  return rows[0] ? { success: true, message: `Запис «${rows[0].name}» ${active ? "активовано" : "деактивовано"}.` } : { success: false, message: "Запис не знайдено." };
}

export async function deleteScheduleCatalogEntry(kind: ScheduleCatalogKind, id: string): Promise<CatalogMutationResult> {
  if (!UUID_PATTERN.test(id)) return { success: false, message: "Некоректний ідентифікатор запису." };
  const sql = getDb();
  try {
    let rows: Array<{ name: string }> = [];
    switch (kind) {
      case "groups": rows = await sql`DELETE FROM academic_groups WHERE id=${id} RETURNING code AS name` as unknown as Array<{name:string}>; break;
      case "disciplines": rows = await sql`DELETE FROM disciplines WHERE id=${id} RETURNING name` as unknown as Array<{name:string}>; break;
      case "rooms": rows = await sql`DELETE FROM schedule_rooms WHERE id=${id} RETURNING name` as unknown as Array<{name:string}>; break;
      case "teachers": rows = await sql`DELETE FROM teachers WHERE id=${id} RETURNING display_name AS name` as unknown as Array<{name:string}>; break;
      case "lesson-types": rows = await sql`DELETE FROM schedule_lesson_types WHERE id=${id} RETURNING name` as unknown as Array<{name:string}>; break;
    }
    return rows[0] ? { success: true, message: `Запис «${rows[0].name}» видалено.` } : { success: false, message: "Запис не знайдено." };
  } catch (error) {
    if ((error as { code?: string }).code === "23503") return { success: false, message: "Запис використовується у розкладі. Спочатку деактивуйте його або змініть пов’язані заняття." };
    throw error;
  }
}
