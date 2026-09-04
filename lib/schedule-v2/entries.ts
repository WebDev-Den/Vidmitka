import "server-only";

import { randomUUID } from "node:crypto";

import { getDb } from "@/lib/db";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

export type ScheduleEntryView = Readonly<{
  id: string;
  disciplineId: string;
  lessonTypeId: string;
  periodId: string;
  periodNumber: number;
  periodTime: string;
  dayOfWeek: number;
  weekPattern: "numerator" | "denominator" | "both";
  validFrom: string | null;
  validUntil: string | null;
  note: string;
  isActive: boolean;
  discipline: string;
  lessonType: string;
  groups: readonly Readonly<{ id: string; name: string }>[];
  teachers: readonly Readonly<{ id: string; name: string }>[];
  rooms: readonly Readonly<{ id: string; name: string }>[];
}>;

export type ScheduleEntryMutationResult = Readonly<{ success: boolean; message: string; id?: string }>;

type EntryRow = {
  id: string; discipline_id: string; lesson_type_id: string; class_period_id: string | number;
  period_number: number; start_minute: number; end_minute: number; day_of_week: number;
  week_pattern: "numerator" | "denominator" | "both"; valid_from: string | null;
  valid_until: string | null; note: string | null; is_active: boolean;
  discipline: string; lesson_type: string;
  groups: Array<{ id: string; name: string }> | null;
  teachers: Array<{ id: string; name: string }> | null;
  rooms: Array<{ id: string; name: string }> | null;
};

function formatMinute(value: number): string {
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.normalize("NFC").trim().replace(/\s+/gu, " ") : "";
}

function ids(formData: FormData, name: string): string[] {
  return [...new Set(formData.getAll(name).filter((value): value is string => typeof value === "string" && UUID_PATTERN.test(value)))];
}

export async function listScheduleEntries(): Promise<ScheduleEntryView[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT entry.id, entry.discipline_id, entry.lesson_type_id, entry.class_period_id,
      period.number AS period_number, period.start_minute, period.end_minute,
      entry.day_of_week, entry.week_pattern, entry.valid_from::text AS valid_from,
      entry.valid_until::text AS valid_until, entry.note, entry.is_active,
      discipline.name AS discipline, lesson_type.name AS lesson_type,
      COALESCE((SELECT JSONB_AGG(JSONB_BUILD_OBJECT('id', group_item.id, 'name', group_item.code) ORDER BY group_item.code)
        FROM schedule_entry_groups link JOIN academic_groups group_item ON group_item.id = link.group_id
        WHERE link.entry_id = entry.id), '[]'::JSONB) AS groups,
      COALESCE((SELECT JSONB_AGG(JSONB_BUILD_OBJECT('id', teacher.id, 'name', teacher.display_name) ORDER BY teacher.display_name)
        FROM schedule_entry_teachers link JOIN teachers teacher ON teacher.id = link.teacher_id
        WHERE link.entry_id = entry.id), '[]'::JSONB) AS teachers,
      COALESCE((SELECT JSONB_AGG(JSONB_BUILD_OBJECT('id', room.id, 'name', room.name) ORDER BY room.name)
        FROM schedule_entry_rooms link JOIN schedule_rooms room ON room.id = link.room_id
        WHERE link.entry_id = entry.id), '[]'::JSONB) AS rooms
    FROM schedule_entries entry
    JOIN disciplines discipline ON discipline.id = entry.discipline_id
    JOIN schedule_lesson_types lesson_type ON lesson_type.id = entry.lesson_type_id
    JOIN class_periods period ON period.id = entry.class_period_id
    ORDER BY entry.day_of_week, period.number, discipline.name
  ` as unknown as EntryRow[];

  return rows.map((row) => ({
    id: row.id, disciplineId: row.discipline_id, lessonTypeId: row.lesson_type_id,
    periodId: String(row.class_period_id), periodNumber: Number(row.period_number),
    periodTime: `${formatMinute(Number(row.start_minute))}–${formatMinute(Number(row.end_minute))}`,
    dayOfWeek: Number(row.day_of_week), weekPattern: row.week_pattern,
    validFrom: row.valid_from, validUntil: row.valid_until, note: row.note ?? "",
    isActive: row.is_active, discipline: row.discipline, lessonType: row.lesson_type,
    groups: row.groups ?? [], teachers: row.teachers ?? [], rooms: row.rooms ?? [],
  }));
}

async function validateEntry(formData: FormData, excludedId?: string) {
  const disciplineId = text(formData, "disciplineId");
  const lessonTypeId = text(formData, "lessonTypeId");
  const periodId = text(formData, "periodId");
  const dayOfWeek = Number(text(formData, "dayOfWeek"));
  const weekPattern = text(formData, "weekPattern");
  const validFrom = text(formData, "validFrom") || null;
  const validUntil = text(formData, "validUntil") || null;
  const note = text(formData, "note");
  const groupIds = ids(formData, "groupIds");
  const teacherIds = ids(formData, "teacherIds");
  const roomIds = ids(formData, "roomIds");

  if (![disciplineId, lessonTypeId].every((id) => UUID_PATTERN.test(id)) || !/^\d+$/u.test(periodId)) {
    return { ok: false as const, message: "Оберіть дисципліну, тип заняття та пару." };
  }
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 1 || dayOfWeek > 7 || !["numerator", "denominator", "both"].includes(weekPattern)) {
    return { ok: false as const, message: "Оберіть коректний день і тип тижня." };
  }
  if (groupIds.length === 0 || teacherIds.length === 0) {
    return { ok: false as const, message: "Додайте щонайменше одну групу й одного викладача." };
  }
  if ((validFrom && !DATE_PATTERN.test(validFrom)) || (validUntil && !DATE_PATTERN.test(validUntil)) || (validFrom && validUntil && validUntil < validFrom)) {
    return { ok: false as const, message: "Перевірте межі дії запису розкладу." };
  }
  if (note.length > 500) return { ok: false as const, message: "Примітка може містити не більше 500 символів." };

  const sql = getDb();
  const groupsJson = JSON.stringify(groupIds);
  const teachersJson = JSON.stringify(teacherIds);
  const roomsJson = JSON.stringify(roomIds);
  const [references] = await sql`
    SELECT
      (SELECT COUNT(*) FROM disciplines WHERE id=${disciplineId} AND is_active) AS disciplines,
      (SELECT COUNT(*) FROM schedule_lesson_types WHERE id=${lessonTypeId} AND is_active) AS lesson_types,
      (SELECT COUNT(*) FROM class_periods WHERE id=${periodId} AND is_active) AS periods,
      (SELECT COUNT(*) FROM academic_groups WHERE is_active AND id IN
        (SELECT value::UUID FROM JSONB_ARRAY_ELEMENTS_TEXT(${groupsJson}::JSONB))) AS groups,
      (SELECT COUNT(*) FROM teachers WHERE is_active AND id IN
        (SELECT value::UUID FROM JSONB_ARRAY_ELEMENTS_TEXT(${teachersJson}::JSONB))) AS teachers,
      (SELECT COUNT(*) FROM schedule_rooms WHERE is_active AND id IN
        (SELECT value::UUID FROM JSONB_ARRAY_ELEMENTS_TEXT(${roomsJson}::JSONB))) AS rooms
  ` as unknown as Array<Record<string, number>>;
  if (!references || Number(references.disciplines) !== 1 || Number(references.lesson_types) !== 1 || Number(references.periods) !== 1 ||
      Number(references.groups) !== groupIds.length || Number(references.teachers) !== teacherIds.length || Number(references.rooms) !== roomIds.length) {
    return { ok: false as const, message: "Один із вибраних довідникових записів не існує або неактивний." };
  }

  const [conflict] = await sql`
    SELECT
      EXISTS (SELECT 1 FROM schedule_entries item JOIN schedule_entry_groups link ON link.entry_id=item.id
        WHERE item.is_active AND item.day_of_week=${dayOfWeek} AND item.class_period_id=${periodId}
          AND (${excludedId ?? null}::UUID IS NULL OR item.id <> ${excludedId ?? null}::UUID)
          AND (item.week_pattern='both' OR ${weekPattern}='both' OR item.week_pattern=${weekPattern})
          AND COALESCE(item.valid_until, 'infinity'::DATE) >= COALESCE(${validFrom}::DATE, '-infinity'::DATE)
          AND COALESCE(${validUntil}::DATE, 'infinity'::DATE) >= COALESCE(item.valid_from, '-infinity'::DATE)
          AND link.group_id IN (SELECT value::UUID FROM JSONB_ARRAY_ELEMENTS_TEXT(${groupsJson}::JSONB))) AS group_conflict,
      EXISTS (SELECT 1 FROM schedule_entries item JOIN schedule_entry_teachers link ON link.entry_id=item.id
        WHERE item.is_active AND item.day_of_week=${dayOfWeek} AND item.class_period_id=${periodId}
          AND (${excludedId ?? null}::UUID IS NULL OR item.id <> ${excludedId ?? null}::UUID)
          AND (item.week_pattern='both' OR ${weekPattern}='both' OR item.week_pattern=${weekPattern})
          AND COALESCE(item.valid_until, 'infinity'::DATE) >= COALESCE(${validFrom}::DATE, '-infinity'::DATE)
          AND COALESCE(${validUntil}::DATE, 'infinity'::DATE) >= COALESCE(item.valid_from, '-infinity'::DATE)
          AND link.teacher_id IN (SELECT value::UUID FROM JSONB_ARRAY_ELEMENTS_TEXT(${teachersJson}::JSONB))) AS teacher_conflict,
      EXISTS (SELECT 1 FROM schedule_entries item JOIN schedule_entry_rooms link ON link.entry_id=item.id
        WHERE item.is_active AND item.day_of_week=${dayOfWeek} AND item.class_period_id=${periodId}
          AND (${excludedId ?? null}::UUID IS NULL OR item.id <> ${excludedId ?? null}::UUID)
          AND (item.week_pattern='both' OR ${weekPattern}='both' OR item.week_pattern=${weekPattern})
          AND COALESCE(item.valid_until, 'infinity'::DATE) >= COALESCE(${validFrom}::DATE, '-infinity'::DATE)
          AND COALESCE(${validUntil}::DATE, 'infinity'::DATE) >= COALESCE(item.valid_from, '-infinity'::DATE)
          AND link.room_id IN (SELECT value::UUID FROM JSONB_ARRAY_ELEMENTS_TEXT(${roomsJson}::JSONB))) AS room_conflict
  ` as unknown as Array<{ group_conflict: boolean; teacher_conflict: boolean; room_conflict: boolean }>;
  const conflicts = [conflict?.group_conflict && "групи", conflict?.teacher_conflict && "викладача", conflict?.room_conflict && "аудиторії"].filter(Boolean);
  if (conflicts.length) return { ok: false as const, message: `Конфлікт розкладу для ${conflicts.join(", ")}.` };

  return { ok: true as const, value: { disciplineId, lessonTypeId, periodId, dayOfWeek, weekPattern, validFrom, validUntil, note, groupIds, teacherIds, roomIds } };
}

function junctionQueries(entryId: string, groupIds: string[], teacherIds: string[], roomIds: string[]) {
  const sql = getDb();
  const groupsJson = JSON.stringify(groupIds), teachersJson = JSON.stringify(teacherIds), roomsJson = JSON.stringify(roomIds);
  return [
    sql`INSERT INTO schedule_entry_groups (entry_id, group_id) SELECT ${entryId}, value::UUID FROM JSONB_ARRAY_ELEMENTS_TEXT(${groupsJson}::JSONB)`,
    sql`INSERT INTO schedule_entry_teachers (entry_id, teacher_id) SELECT ${entryId}, value::UUID FROM JSONB_ARRAY_ELEMENTS_TEXT(${teachersJson}::JSONB)`,
    sql`INSERT INTO schedule_entry_rooms (entry_id, room_id) SELECT ${entryId}, value::UUID FROM JSONB_ARRAY_ELEMENTS_TEXT(${roomsJson}::JSONB)`,
  ];
}

export async function createScheduleEntry(administratorId: string, formData: FormData): Promise<ScheduleEntryMutationResult> {
  const validation = await validateEntry(formData);
  if (!validation.ok) return { success: false, message: validation.message };
  const id = randomUUID(), sql = getDb(), value = validation.value;
  await sql.transaction([
    sql`INSERT INTO schedule_entries (id, discipline_id, lesson_type_id, class_period_id, day_of_week, week_pattern,
      valid_from, valid_until, note, created_by_user_id, updated_by_user_id)
      VALUES (${id}, ${value.disciplineId}, ${value.lessonTypeId}, ${value.periodId}, ${value.dayOfWeek}, ${value.weekPattern},
        ${value.validFrom}, ${value.validUntil}, ${value.note || null}, ${administratorId}, ${administratorId})`,
    ...junctionQueries(id, value.groupIds, value.teacherIds, value.roomIds),
  ]);
  return { success: true, message: "Запис розкладу створено.", id };
}

export async function updateScheduleEntry(administratorId: string, id: string, formData: FormData): Promise<ScheduleEntryMutationResult> {
  if (!UUID_PATTERN.test(id)) return { success: false, message: "Некоректний ідентифікатор запису." };
  const validation = await validateEntry(formData, id);
  if (!validation.ok) return { success: false, message: validation.message };
  const sql = getDb(), value = validation.value;
  const results = await sql.transaction([
    sql`UPDATE schedule_entries SET discipline_id=${value.disciplineId}, lesson_type_id=${value.lessonTypeId},
      class_period_id=${value.periodId}, day_of_week=${value.dayOfWeek}, week_pattern=${value.weekPattern},
      valid_from=${value.validFrom}, valid_until=${value.validUntil}, note=${value.note || null},
      updated_by_user_id=${administratorId}, updated_at=NOW() WHERE id=${id} RETURNING id`,
    sql`DELETE FROM schedule_entry_groups WHERE entry_id=${id}`,
    sql`DELETE FROM schedule_entry_teachers WHERE entry_id=${id}`,
    sql`DELETE FROM schedule_entry_rooms WHERE entry_id=${id}`,
    ...junctionQueries(id, value.groupIds, value.teacherIds, value.roomIds),
  ]);
  const updated = results[0] as unknown as Array<{ id: string }>;
  return updated.length ? { success: true, message: "Запис розкладу оновлено." } : { success: false, message: "Запис не знайдено." };
}

export async function setScheduleEntryActive(administratorId: string, id: string, active: boolean): Promise<ScheduleEntryMutationResult> {
  if (!UUID_PATTERN.test(id)) return { success: false, message: "Некоректний ідентифікатор запису." };
  if (active) {
    const entry = (await listScheduleEntries()).find((item) => item.id === id);
    if (!entry) return { success: false, message: "Запис не знайдено." };
    const form = new FormData();
    for (const [name, value] of Object.entries({ disciplineId: entry.disciplineId, lessonTypeId: entry.lessonTypeId,
      periodId: entry.periodId, dayOfWeek: String(entry.dayOfWeek), weekPattern: entry.weekPattern,
      validFrom: entry.validFrom ?? "", validUntil: entry.validUntil ?? "", note: entry.note })) form.set(name, value);
    for (const group of entry.groups) form.append("groupIds", group.id);
    for (const teacher of entry.teachers) form.append("teacherIds", teacher.id);
    for (const room of entry.rooms) form.append("roomIds", room.id);
    const validation = await validateEntry(form, id);
    if (!validation.ok) return { success: false, message: validation.message };
  }
  const sql = getDb();
  const rows = await sql`UPDATE schedule_entries SET is_active=${active}, updated_by_user_id=${administratorId}, updated_at=NOW()
    WHERE id=${id} RETURNING id` as unknown as Array<{ id: string }>;
  return rows.length ? { success: true, message: active ? "Запис активовано." : "Запис деактивовано." } : { success: false, message: "Запис не знайдено." };
}

export async function deleteScheduleEntry(id: string): Promise<ScheduleEntryMutationResult> {
  if (!UUID_PATTERN.test(id)) return { success: false, message: "Некоректний ідентифікатор запису." };
  const sql = getDb();
  try {
    const rows = await sql`DELETE FROM schedule_entries WHERE id=${id} RETURNING id` as unknown as Array<{ id: string }>;
    return rows.length ? { success: true, message: "Запис розкладу видалено." } : { success: false, message: "Запис не знайдено." };
  } catch (error) {
    if ((error as { code?: string }).code === "23503") return { success: false, message: "Для запису існують винятки. Спочатку видаліть або змініть їх." };
    throw error;
  }
}
