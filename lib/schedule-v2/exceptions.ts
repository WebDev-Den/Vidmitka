import "server-only";

import { randomUUID } from "node:crypto";

import { getDb } from "@/lib/db";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const KINDS = ["move", "reschedule", "room_change", "teacher_change", "discipline_change", "type_change", "cancel", "one_time"] as const;
export type ScheduleExceptionKind = typeof KINDS[number];
export type ScheduleExceptionMutationResult = Readonly<{ success: boolean; message: string }>;
export type ScheduleExceptionView = Readonly<{
  id: string; baseEntryId: string | null; kind: ScheduleExceptionKind; originalDate: string; newDate: string | null;
  periodId: string | null; customStartTime: string | null; customEndTime: string | null;
  disciplineId: string | null; lessonTypeId: string | null; reason: string; note: string;
  status: "active" | "superseded" | "cancelled"; sourceKind: string | null;
  groups: readonly Readonly<{ id: string; name: string }>[];
  teachers: readonly Readonly<{ id: string; name: string }>[];
  rooms: readonly Readonly<{ id: string; name: string }>[];
  baseLabel: string | null;
}>;

type ExceptionRow = {
  id: string; base_entry_id: string | null; kind: ScheduleExceptionKind; original_date: string; new_date: string | null;
  class_period_id: string | number | null; discipline_id: string | null; lesson_type_id: string | null; reason: string | null;
  custom_start_time: string | null; custom_end_time: string | null;
  note: string | null; status: "active" | "superseded" | "cancelled"; source_kind: string | null; base_label: string | null;
  groups: Array<{ id: string; name: string }> | null; teachers: Array<{ id: string; name: string }> | null;
  rooms: Array<{ id: string; name: string }> | null;
};

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.normalize("NFC").trim().replace(/\s+/gu, " ") : "";
}
function ids(formData: FormData, name: string): string[] {
  return [...new Set(formData.getAll(name).filter((value): value is string => typeof value === "string" && UUID_PATTERN.test(value)))];
}

export async function listScheduleExceptions(): Promise<ScheduleExceptionView[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT exception.id, exception.base_entry_id, exception.kind, exception.original_date::text AS original_date,
      exception.new_date::text AS new_date, exception.class_period_id,
      LEFT(exception.custom_start_time::text, 5) AS custom_start_time,
      LEFT(exception.custom_end_time::text, 5) AS custom_end_time,
      exception.discipline_id, exception.lesson_type_id,
      exception.reason, exception.note, exception.status, exception.source_kind,
      CASE WHEN base.id IS NULL THEN NULL ELSE discipline.name || ' · ' || period.number || ' пара · ' ||
        ARRAY_TO_STRING(ARRAY(SELECT group_item.code FROM schedule_entry_groups link
          JOIN academic_groups group_item ON group_item.id=link.group_id WHERE link.entry_id=base.id ORDER BY group_item.code), ', ') END AS base_label,
      COALESCE((SELECT JSONB_AGG(JSONB_BUILD_OBJECT('id', group_item.id, 'name', group_item.code) ORDER BY group_item.code)
        FROM schedule_exception_groups link JOIN academic_groups group_item ON group_item.id=link.group_id
        WHERE link.exception_id=exception.id), '[]'::JSONB) AS groups,
      COALESCE((SELECT JSONB_AGG(JSONB_BUILD_OBJECT('id', teacher.id, 'name', teacher.display_name) ORDER BY teacher.display_name)
        FROM schedule_exception_teachers link JOIN teachers teacher ON teacher.id=link.teacher_id
        WHERE link.exception_id=exception.id), '[]'::JSONB) AS teachers,
      COALESCE((SELECT JSONB_AGG(JSONB_BUILD_OBJECT('id', room.id, 'name', room.name) ORDER BY room.name)
        FROM schedule_exception_rooms link JOIN schedule_rooms room ON room.id=link.room_id
        WHERE link.exception_id=exception.id), '[]'::JSONB) AS rooms
    FROM schedule_exceptions exception
    LEFT JOIN schedule_entries base ON base.id=exception.base_entry_id
    LEFT JOIN disciplines discipline ON discipline.id=base.discipline_id
    LEFT JOIN class_periods period ON period.id=base.class_period_id
    ORDER BY exception.original_date DESC, exception.updated_at DESC
  ` as unknown as ExceptionRow[];
  return rows.map((row) => ({
    id: row.id, baseEntryId: row.base_entry_id, kind: row.kind, originalDate: row.original_date,
    newDate: row.new_date, periodId: row.class_period_id == null ? null : String(row.class_period_id),
    customStartTime: row.custom_start_time, customEndTime: row.custom_end_time,
    disciplineId: row.discipline_id, lessonTypeId: row.lesson_type_id, reason: row.reason ?? "", note: row.note ?? "",
    status: row.status, sourceKind: row.source_kind, groups: row.groups ?? [], teachers: row.teachers ?? [],
    rooms: row.rooms ?? [], baseLabel: row.base_label,
  }));
}

function validateException(formData: FormData) {
  const kind = text(formData, "kind") as ScheduleExceptionKind;
  const baseEntryId = text(formData, "baseEntryId") || null;
  const originalDate = text(formData, "originalDate");
  const newDate = text(formData, "newDate") || null;
  const periodId = text(formData, "periodId") || null;
  const customStartTime = text(formData, "customStartTime") || null;
  const customEndTime = text(formData, "customEndTime") || null;
  const disciplineId = text(formData, "disciplineId") || null;
  const lessonTypeId = text(formData, "lessonTypeId") || null;
  const reason = text(formData, "reason");
  const note = text(formData, "note");
  const groupIds = ids(formData, "groupIds"), teacherIds = ids(formData, "teacherIds"), roomIds = ids(formData, "roomIds");
  const status = text(formData, "status") || "active";

  if (!KINDS.includes(kind)) return { ok: false as const, message: "Оберіть тип винятку." };
  if (!DATE_PATTERN.test(originalDate) || (newDate && !DATE_PATTERN.test(newDate))) return { ok: false as const, message: "Вкажіть коректну дату." };
  if (kind !== "one_time" && (!baseEntryId || !UUID_PATTERN.test(baseEntryId))) return { ok: false as const, message: "Оберіть базове заняття для зміни." };
  if (["move", "reschedule"].includes(kind) && !newDate) return { ok: false as const, message: "Для перенесення вкажіть нову дату." };
  if (kind === "room_change" && roomIds.length === 0) return { ok: false as const, message: "Оберіть нову аудиторію." };
  if (kind === "teacher_change" && teacherIds.length === 0) return { ok: false as const, message: "Оберіть нового викладача." };
  if (kind === "discipline_change" && !disciplineId) return { ok: false as const, message: "Оберіть нову дисципліну." };
  if (kind === "type_change" && !lessonTypeId) return { ok: false as const, message: "Оберіть новий тип заняття." };
  if (kind === "reschedule" && !periodId && !customStartTime) return { ok: false as const, message: "Оберіть нову пару або власний час." };
  if (kind === "one_time" && (!periodId || !disciplineId || !lessonTypeId || groupIds.length === 0 || teacherIds.length === 0)) {
    return { ok: false as const, message: "Для разового заняття оберіть пару, дисципліну, тип, групу й викладача." };
  }
  if (periodId && !/^\d+$/u.test(periodId)) return { ok: false as const, message: "Некоректна пара." };
  if ((customStartTime || customEndTime) && (!/^([01]\d|2[0-3]):[0-5]\d$/u.test(customStartTime ?? "") ||
      !/^([01]\d|2[0-3]):[0-5]\d$/u.test(customEndTime ?? "") || customEndTime! <= customStartTime!)) {
    return { ok: false as const, message: "Вкажіть коректний власний час початку й завершення." };
  }
  if ([disciplineId, lessonTypeId].some((id) => id && !UUID_PATTERN.test(id)) || !["active", "superseded", "cancelled"].includes(status)) {
    return { ok: false as const, message: "Некоректні пов’язані дані." };
  }
  if (reason.length > 500 || note.length > 500) return { ok: false as const, message: "Причина й примітка можуть містити до 500 символів." };
  return { ok: true as const, value: { kind, baseEntryId, originalDate, newDate, periodId, customStartTime, customEndTime, disciplineId, lessonTypeId,
    reason, note, status, groupIds, teacherIds, roomIds } };
}

function exceptionLinks(id: string, groupIds: string[], teacherIds: string[], roomIds: string[]) {
  const sql = getDb();
  const groupsJson=JSON.stringify(groupIds), teachersJson=JSON.stringify(teacherIds), roomsJson=JSON.stringify(roomIds);
  return [
    sql`INSERT INTO schedule_exception_groups (exception_id, group_id) SELECT ${id}, value::UUID FROM JSONB_ARRAY_ELEMENTS_TEXT(${groupsJson}::JSONB)`,
    sql`INSERT INTO schedule_exception_teachers (exception_id, teacher_id) SELECT ${id}, value::UUID FROM JSONB_ARRAY_ELEMENTS_TEXT(${teachersJson}::JSONB)`,
    sql`INSERT INTO schedule_exception_rooms (exception_id, room_id) SELECT ${id}, value::UUID FROM JSONB_ARRAY_ELEMENTS_TEXT(${roomsJson}::JSONB)`,
  ];
}

type ValidatedException = Extract<ReturnType<typeof validateException>, { ok: true }>["value"];

async function referencesExist(value: ValidatedException): Promise<boolean> {
  const sql=getDb();
  const groupsJson=JSON.stringify(value.groupIds), teachersJson=JSON.stringify(value.teacherIds), roomsJson=JSON.stringify(value.roomIds);
  const [row]=await sql`SELECT
    (${value.baseEntryId}::UUID IS NULL OR EXISTS (SELECT 1 FROM schedule_entries WHERE id=${value.baseEntryId}::UUID)) AS base_ok,
    (${value.periodId}::BIGINT IS NULL OR EXISTS (SELECT 1 FROM class_periods WHERE id=${value.periodId}::BIGINT)) AS period_ok,
    (${value.disciplineId}::UUID IS NULL OR EXISTS (SELECT 1 FROM disciplines WHERE id=${value.disciplineId}::UUID)) AS discipline_ok,
    (${value.lessonTypeId}::UUID IS NULL OR EXISTS (SELECT 1 FROM schedule_lesson_types WHERE id=${value.lessonTypeId}::UUID)) AS type_ok,
    (SELECT COUNT(*) FROM academic_groups WHERE id IN (SELECT item.value::UUID FROM JSONB_ARRAY_ELEMENTS_TEXT(${groupsJson}::JSONB) AS item(value)))=${value.groupIds.length} AS groups_ok,
    (SELECT COUNT(*) FROM teachers WHERE id IN (SELECT item.value::UUID FROM JSONB_ARRAY_ELEMENTS_TEXT(${teachersJson}::JSONB) AS item(value)))=${value.teacherIds.length} AS teachers_ok,
    (SELECT COUNT(*) FROM schedule_rooms WHERE id IN (SELECT item.value::UUID FROM JSONB_ARRAY_ELEMENTS_TEXT(${roomsJson}::JSONB) AS item(value)))=${value.roomIds.length} AS rooms_ok
  ` as unknown as Array<Record<string,boolean>>;
  return Boolean(row && Object.values(row).every(Boolean));
}

export async function createScheduleException(administratorId: string, formData: FormData): Promise<ScheduleExceptionMutationResult> {
  const validation = validateException(formData);
  if (!validation.ok) return { success: false, message: validation.message };
  if (!await referencesExist(validation.value)) return { success: false, message: "Один із пов’язаних записів не існує." };
  const id=randomUUID(), value=validation.value, sql=getDb();
  await sql.transaction([
    sql`INSERT INTO schedule_exceptions (id, base_entry_id, kind, original_date, new_date, class_period_id, custom_start_time, custom_end_time,
      discipline_id, lesson_type_id, reason, note, status, created_by_user_id, updated_by_user_id)
      VALUES (${id}, ${value.baseEntryId}, ${value.kind}, ${value.originalDate}, ${value.newDate}, ${value.periodId}, ${value.customStartTime}, ${value.customEndTime},
        ${value.disciplineId}, ${value.lessonTypeId}, ${value.reason || null}, ${value.note || null}, ${value.status},
        ${administratorId}, ${administratorId})`,
    ...exceptionLinks(id, value.groupIds, value.teacherIds, value.roomIds),
  ]);
  return { success: true, message: "Виняток створено." };
}

export async function updateScheduleException(administratorId: string, id: string, formData: FormData): Promise<ScheduleExceptionMutationResult> {
  if (!UUID_PATTERN.test(id)) return { success: false, message: "Некоректний ідентифікатор винятку." };
  const validation=validateException(formData);
  if (!validation.ok) return { success: false, message: validation.message };
  if (!await referencesExist(validation.value)) return { success: false, message: "Один із пов’язаних записів не існує." };
  const value=validation.value, sql=getDb();
  const results=await sql.transaction([
    sql`UPDATE schedule_exceptions SET base_entry_id=${value.baseEntryId}, kind=${value.kind}, original_date=${value.originalDate},
      new_date=${value.newDate}, class_period_id=${value.periodId}, custom_start_time=${value.customStartTime}, custom_end_time=${value.customEndTime},
      discipline_id=${value.disciplineId}, lesson_type_id=${value.lessonTypeId},
      reason=${value.reason || null}, note=${value.note || null}, status=${value.status}, updated_by_user_id=${administratorId}, updated_at=NOW()
      WHERE id=${id} RETURNING id`,
    sql`DELETE FROM schedule_exception_groups WHERE exception_id=${id}`,
    sql`DELETE FROM schedule_exception_teachers WHERE exception_id=${id}`,
    sql`DELETE FROM schedule_exception_rooms WHERE exception_id=${id}`,
    ...exceptionLinks(id, value.groupIds, value.teacherIds, value.roomIds),
  ]);
  const updated=results[0] as unknown as Array<{id:string}>;
  return updated.length ? { success: true, message: "Виняток оновлено." } : { success: false, message: "Виняток не знайдено." };
}

export async function deleteScheduleException(id: string): Promise<ScheduleExceptionMutationResult> {
  if (!UUID_PATTERN.test(id)) return { success: false, message: "Некоректний ідентифікатор винятку." };
  const sql=getDb();
  const rows=await sql`DELETE FROM schedule_exceptions WHERE id=${id} RETURNING id` as unknown as Array<{id:string}>;
  return rows.length ? { success: true, message: "Виняток видалено." } : { success: false, message: "Виняток не знайдено." };
}
