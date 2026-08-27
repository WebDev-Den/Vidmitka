import "server-only";

import { getDb } from "@/lib/db";

export type Subject = Readonly<{
  id: string;
  name: string;
  isActive: boolean;
}>;

export type SubjectMutationResult = Readonly<{
  success: boolean;
  message: string;
}>;

type SubjectRow = {
  id: string | number;
  name: string;
  is_active: boolean;
};

function normalizeSubjectName(value: FormDataEntryValue | null): string {
  return typeof value === "string"
    ? value.trim().replace(/\s+/gu, " ")
    : "";
}

function toSubject(row: SubjectRow): Subject {
  return {
    id: String(row.id),
    name: row.name,
    isActive: row.is_active,
  };
}

export async function listSubjects(options?: {
  activeOnly?: boolean;
}): Promise<Subject[]> {
  const sql = getDb();
  const rows = (await sql`
    SELECT id, name, is_active
    FROM subjects
    ORDER BY name ASC
  `) as unknown as SubjectRow[];
  const subjects = rows.map(toSubject);

  return options?.activeOnly
    ? subjects.filter((subject) => subject.isActive)
    : subjects;
}

export async function createSubject(
  nameValue: FormDataEntryValue | null,
): Promise<SubjectMutationResult> {
  const name = normalizeSubjectName(nameValue);

  if (name.length < 2 || name.length > 200) {
    return { success: false, message: "Вкажіть коректну назву предмета." };
  }

  const sql = getDb();

  try {
    await sql`INSERT INTO subjects (name) VALUES (${name})`;
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      return { success: false, message: "Предмет із такою назвою вже існує." };
    }
    throw error;
  }

  return { success: true, message: `Предмет «${name}» додано.` };
}

export async function setSubjectActive(
  id: string,
  isActive: boolean,
): Promise<SubjectMutationResult> {
  if (!/^\d+$/u.test(id)) {
    return { success: false, message: "Некоректний ідентифікатор предмета." };
  }

  const sql = getDb();
  const rows = (await sql`
    UPDATE subjects
    SET is_active = ${isActive}, updated_at = NOW()
    WHERE id = ${id}
    RETURNING name
  `) as unknown as Array<{ name: string }>;

  if (!rows[0]) return { success: false, message: "Предмет не знайдено." };

  return {
    success: true,
    message: isActive
      ? `Предмет «${rows[0].name}» активовано.`
      : `Предмет «${rows[0].name}» деактивовано.`,
  };
}
