import "server-only";

import { getDb } from "@/lib/db";
import type { DirectoryCreateResult } from "@/lib/lessons/directory-options";

export type Room = Readonly<{
  id: string;
  name: string;
  isActive: boolean;
}>;

export type RoomMutationResult = Readonly<{
  success: boolean;
  message: string;
}>;

type RoomRow = {
  id: string | number;
  name: string;
  is_active: boolean;
};

function normalizeRoomName(value: FormDataEntryValue | null): string {
  return typeof value === "string"
    ? value.trim().replace(/\s+/gu, " ")
    : "";
}

export async function listRooms(options?: { activeOnly?: boolean }): Promise<Room[]> {
  const sql = getDb();
  const rows = (await sql`
    SELECT id, name, is_active
    FROM rooms
    ORDER BY name ASC
  `) as unknown as RoomRow[];
  const rooms = rows.map((row) => ({
    id: String(row.id),
    name: row.name,
    isActive: row.is_active,
  }));

  return options?.activeOnly ? rooms.filter((room) => room.isActive) : rooms;
}

export async function createRoom(
  nameValue: FormDataEntryValue | null,
): Promise<RoomMutationResult> {
  const { success, message } = await createRoomOption(nameValue);
  return { success, message };
}

export async function createRoomOption(
  nameValue: FormDataEntryValue | null,
): Promise<DirectoryCreateResult> {
  const name = normalizeRoomName(nameValue);

  if (name.length < 1 || name.length > 100) {
    return { success: false, message: "Вкажіть коректну назву аудиторії." };
  }

  const sql = getDb();

  try {
    const [row] = (await sql`
      INSERT INTO rooms (name) VALUES (${name}) RETURNING id, name
    `) as unknown as Array<{ id: string | number; name: string }>;
    if (!row) return { success: false, message: "Не вдалося додати аудиторію." };
    return { success: true, message: `Аудиторію «${row.name}» додано.`, option: { id: String(row.id), name: row.name } };
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      return { success: false, message: "Аудиторія з такою назвою вже існує." };
    }
    throw error;
  }
}

export async function setRoomActive(
  id: string,
  isActive: boolean,
): Promise<RoomMutationResult> {
  if (!/^\d+$/u.test(id)) {
    return { success: false, message: "Некоректний ідентифікатор аудиторії." };
  }

  const sql = getDb();
  const rows = (await sql`
    UPDATE rooms
    SET is_active = ${isActive}, updated_at = NOW()
    WHERE id = ${id}
    RETURNING name
  `) as unknown as Array<{ name: string }>;

  if (!rows[0]) return { success: false, message: "Аудиторію не знайдено." };

  return {
    success: true,
    message: isActive
      ? `Аудиторію «${rows[0].name}» активовано.`
      : `Аудиторію «${rows[0].name}» деактивовано.`,
  };
}
