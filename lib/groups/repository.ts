import "server-only";
import { getDb } from "@/lib/db";

export type StudentGroup = { name: string; studentCount: number };
export type GroupStudent = { id: string; fullName: string; groupName: string };

// Цей каталог містить лише спільні ПІБ/групи. Приватні предметні зв’язки та
// відвідування не передаються до форми створення заняття.
export async function listStudentGroups(): Promise<StudentGroup[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT g.name, COUNT(s.id)::INT AS student_count FROM student_groups g
    LEFT JOIN students s ON s.group_name = g.name AND s.is_active
    GROUP BY g.name ORDER BY g.name
  ` as unknown as { name: string; student_count: number }[];
  return rows.map((row) => ({ name: row.name, studentCount: row.student_count }));
}

export async function listGroupStudents(): Promise<GroupStudent[]> {
  const sql = getDb();
  const rows = await sql`SELECT id, full_name, group_name FROM students WHERE is_active ORDER BY group_name, full_name` as unknown as {
    id: string | number; full_name: string; group_name: string;
  }[];
  return rows.map((row) => ({ id: String(row.id), fullName: row.full_name, groupName: row.group_name }));
}
