import "server-only";

import { parsePeriodColor, type PeriodColor } from "@/lib/class-periods/colors";
import { getDb } from "@/lib/db";
import { getDateKeyInTimeZone } from "@/lib/schedule-week/rules";

import { getCalendarDayContext } from "./calendar-overrides";
import type { CalendarWeekType } from "./calendar-override-rules";
import { shouldShowBaseOccurrence } from "./occurrence-rules";
import type { PublicRoom } from "./free-rooms";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export type PublicGroup = Readonly<{ id: string; name: string }>;
export type PublicTeacher = Readonly<{ id: string; name: string }>;
export type PublicPeriod = Readonly<{
  id: string;
  number: number;
  startTime: string;
  endTime: string;
  color: PeriodColor;
}>;
export type PublicScheduleItem = Readonly<{
  id: string; occurrenceDate: string; periodNumber: number; startTime: string; endTime: string;
  discipline: string; lessonType: string; lessonTypeColor: string;
  groups: readonly string[]; teachers: readonly string[]; rooms: readonly string[];
  note: string; changeKind: string | null; changeReason: string; cancelled: boolean; originalDate: string | null;
}>;
export type PublicScheduleDay = Readonly<{
  date: string;
  calendarDayOfWeek: number;
  scheduleDayOfWeek: number;
  weekType: CalendarWeekType;
  weekConfigured: boolean;
  isTransfer: boolean;
  items: readonly PublicScheduleItem[];
}>;

type PublicRow = {
  id: string; occurrence_date: string; period_number: number; start_time: string; end_time: string;
  discipline: string; lesson_type: string; lesson_type_color: string; groups: string[] | null;
  teachers: string[] | null; rooms: string[] | null; note: string | null; change_kind: string | null;
  change_reason: string | null; cancelled: boolean; original_date: string | null;
  new_date: string | null; source_kind?: string | null;
};

function validDate(value: string | undefined): string {
  const timestamp = value && DATE_PATTERN.test(value) ? Date.parse(`${value}T00:00:00Z`) : Number.NaN;
  if (!value || !Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) return getDateKeyInTimeZone(new Date());
  return value;
}

function mapRows(rows: PublicRow[]): PublicScheduleItem[] {
  return rows.map((row) => ({ id: row.id, occurrenceDate: row.occurrence_date,
    periodNumber: Number(row.period_number), startTime: row.start_time.slice(0, 5), endTime: row.end_time.slice(0, 5),
    discipline: row.discipline, lessonType: row.lesson_type, lessonTypeColor: row.lesson_type_color,
    groups: row.groups ?? [], teachers: row.teachers ?? [], rooms: row.rooms ?? [], note: row.note ?? "",
    changeKind: row.change_kind, changeReason: row.change_reason ?? "", cancelled: row.cancelled,
    originalDate: row.original_date,
  }));
}

export async function listPublicGroups(): Promise<PublicGroup[]> {
  const sql = getDb();
  const rows = await sql`SELECT id, code AS name FROM academic_groups WHERE is_active ORDER BY code` as unknown as PublicGroup[];
  return rows;
}

export async function listPublicTeachers(): Promise<PublicTeacher[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT id::TEXT, display_name AS name
    FROM teachers
    WHERE is_active
    ORDER BY display_name
  ` as unknown as PublicTeacher[];
  return rows;
}

export async function listPublicRooms(): Promise<PublicRoom[]> {
  const sql = getDb();
  return await sql`
    SELECT id::TEXT, name
    FROM schedule_rooms
    WHERE is_active
    ORDER BY name
  ` as unknown as PublicRoom[];
}

export async function listPublicPeriods(): Promise<PublicPeriod[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT id::TEXT, number, MAKE_TIME(start_minute/60, start_minute%60, 0)::TEXT AS start_time,
      MAKE_TIME(end_minute/60, end_minute%60, 0)::TEXT AS end_time, color
    FROM class_periods
    WHERE is_active
    ORDER BY number
  ` as unknown as Array<{
    id: string;
    number: number;
    start_time: string;
    end_time: string;
    color: string;
  }>;
  return rows.map((row) => ({
    id: row.id,
    number: Number(row.number),
    startTime: row.start_time.slice(0, 5),
    endTime: row.end_time.slice(0, 5),
    color: parsePeriodColor(row.color) ?? "#0F766E",
  }));
}

export async function getPublicScheduleDay(input: {
  date?: string;
  groupId?: string | null;
  teacherId?: string | null;
}): Promise<PublicScheduleDay> {
  const date = validDate(input.date);
  const groupId = input.groupId && UUID_PATTERN.test(input.groupId) ? input.groupId : null;
  const teacherId = input.teacherId && UUID_PATTERN.test(input.teacherId) ? input.teacherId : null;
  const context = await getCalendarDayContext(date);
  const weekType = context.weekType ?? "numerator";
  const weekday = context.dayOfWeek;
  const sql = getDb();

  const [baseRows, movedRows, oneTimeRows, legacyImportedRows] = await Promise.all([
    sql`
      SELECT entry.id, ${date}::DATE::TEXT AS occurrence_date, period.number AS period_number,
        COALESCE(exception.custom_start_time, MAKE_TIME(period.start_minute/60, period.start_minute%60, 0))::TEXT AS start_time,
        COALESCE(exception.custom_end_time, MAKE_TIME(period.end_minute/60, period.end_minute%60, 0))::TEXT AS end_time,
        COALESCE(changed_discipline.name, discipline.name) AS discipline,
        COALESCE(changed_type.name, lesson_type.name) AS lesson_type,
        COALESCE(changed_type.color, lesson_type.color) AS lesson_type_color,
        CASE WHEN exception.id IS NOT NULL AND EXISTS (SELECT 1 FROM schedule_exception_groups WHERE exception_id=exception.id)
          THEN ARRAY(SELECT group_item.code FROM schedule_exception_groups link JOIN academic_groups group_item ON group_item.id=link.group_id WHERE link.exception_id=exception.id ORDER BY group_item.code)
          ELSE ARRAY(SELECT group_item.code FROM schedule_entry_groups link JOIN academic_groups group_item ON group_item.id=link.group_id WHERE link.entry_id=entry.id ORDER BY group_item.code) END AS groups,
        CASE WHEN exception.id IS NOT NULL AND EXISTS (SELECT 1 FROM schedule_exception_teachers WHERE exception_id=exception.id)
          THEN ARRAY(SELECT teacher.display_name FROM schedule_exception_teachers link JOIN teachers teacher ON teacher.id=link.teacher_id WHERE link.exception_id=exception.id ORDER BY teacher.display_name)
          ELSE ARRAY(SELECT teacher.display_name FROM schedule_entry_teachers link JOIN teachers teacher ON teacher.id=link.teacher_id WHERE link.entry_id=entry.id ORDER BY teacher.display_name) END AS teachers,
        CASE WHEN exception.id IS NOT NULL AND EXISTS (SELECT 1 FROM schedule_exception_rooms WHERE exception_id=exception.id)
          THEN ARRAY(SELECT room.name FROM schedule_exception_rooms link JOIN schedule_rooms room ON room.id=link.room_id WHERE link.exception_id=exception.id ORDER BY room.name)
          ELSE ARRAY(SELECT room.name FROM schedule_entry_rooms link JOIN schedule_rooms room ON room.id=link.room_id WHERE link.entry_id=entry.id ORDER BY room.name) END AS rooms,
        COALESCE(exception.note, entry.note) AS note, exception.kind AS change_kind,
        exception.reason AS change_reason, COALESCE(exception.kind='cancel', FALSE) AS cancelled,
        exception.original_date::TEXT AS original_date, exception.new_date::TEXT AS new_date
      FROM schedule_entries entry
      JOIN disciplines discipline ON discipline.id=entry.discipline_id
      JOIN schedule_lesson_types lesson_type ON lesson_type.id=entry.lesson_type_id
      LEFT JOIN LATERAL (SELECT item.* FROM schedule_exceptions item WHERE item.base_entry_id=entry.id
        AND item.original_date=${date} AND item.status='active' ORDER BY item.updated_at DESC LIMIT 1) exception ON TRUE
      LEFT JOIN disciplines changed_discipline ON changed_discipline.id=exception.discipline_id
      LEFT JOIN schedule_lesson_types changed_type ON changed_type.id=exception.lesson_type_id
      JOIN class_periods period ON period.id=COALESCE(exception.class_period_id, entry.class_period_id)
      WHERE entry.is_active AND entry.day_of_week=${weekday}
        AND (entry.week_pattern='both' OR entry.week_pattern=${weekType})
        AND (entry.valid_from IS NULL OR entry.valid_from<=${date}) AND (entry.valid_until IS NULL OR entry.valid_until>=${date})
        AND (${groupId}::UUID IS NULL OR (
          (exception.id IS NOT NULL AND EXISTS (SELECT 1 FROM schedule_exception_groups WHERE exception_id=exception.id)
            AND EXISTS (SELECT 1 FROM schedule_exception_groups WHERE exception_id=exception.id AND group_id=${groupId}::UUID))
          OR (NOT EXISTS (SELECT 1 FROM schedule_exception_groups WHERE exception_id=exception.id)
            AND EXISTS (SELECT 1 FROM schedule_entry_groups WHERE entry_id=entry.id AND group_id=${groupId}::UUID))))
        AND (${teacherId}::UUID IS NULL
          OR NOT EXISTS (SELECT 1 FROM teachers selected_teacher WHERE selected_teacher.id=${teacherId}::UUID AND selected_teacher.is_active)
          OR (
          (exception.id IS NOT NULL AND EXISTS (SELECT 1 FROM schedule_exception_teachers WHERE exception_id=exception.id)
            AND EXISTS (SELECT 1 FROM schedule_exception_teachers WHERE exception_id=exception.id AND teacher_id=${teacherId}::UUID))
          OR (NOT EXISTS (SELECT 1 FROM schedule_exception_teachers WHERE exception_id=exception.id)
            AND EXISTS (SELECT 1 FROM schedule_entry_teachers WHERE entry_id=entry.id AND teacher_id=${teacherId}::UUID))))
    ` as unknown as Promise<PublicRow[]>,
    sql`
      SELECT exception.id, ${date}::DATE::TEXT AS occurrence_date, period.number AS period_number,
        COALESCE(exception.custom_start_time, MAKE_TIME(period.start_minute/60, period.start_minute%60, 0))::TEXT AS start_time,
        COALESCE(exception.custom_end_time, MAKE_TIME(period.end_minute/60, period.end_minute%60, 0))::TEXT AS end_time,
        COALESCE(changed_discipline.name, discipline.name) AS discipline,
        COALESCE(changed_type.name, lesson_type.name) AS lesson_type,
        COALESCE(changed_type.color, lesson_type.color) AS lesson_type_color,
        CASE WHEN EXISTS (SELECT 1 FROM schedule_exception_groups WHERE exception_id=exception.id)
          THEN ARRAY(SELECT group_item.code FROM schedule_exception_groups link JOIN academic_groups group_item ON group_item.id=link.group_id WHERE link.exception_id=exception.id ORDER BY group_item.code)
          ELSE ARRAY(SELECT group_item.code FROM schedule_entry_groups link JOIN academic_groups group_item ON group_item.id=link.group_id WHERE link.entry_id=entry.id ORDER BY group_item.code) END AS groups,
        CASE WHEN EXISTS (SELECT 1 FROM schedule_exception_teachers WHERE exception_id=exception.id)
          THEN ARRAY(SELECT teacher.display_name FROM schedule_exception_teachers link JOIN teachers teacher ON teacher.id=link.teacher_id WHERE link.exception_id=exception.id ORDER BY teacher.display_name)
          ELSE ARRAY(SELECT teacher.display_name FROM schedule_entry_teachers link JOIN teachers teacher ON teacher.id=link.teacher_id WHERE link.entry_id=entry.id ORDER BY teacher.display_name) END AS teachers,
        CASE WHEN EXISTS (SELECT 1 FROM schedule_exception_rooms WHERE exception_id=exception.id)
          THEN ARRAY(SELECT room.name FROM schedule_exception_rooms link JOIN schedule_rooms room ON room.id=link.room_id WHERE link.exception_id=exception.id ORDER BY room.name)
          ELSE ARRAY(SELECT room.name FROM schedule_entry_rooms link JOIN schedule_rooms room ON room.id=link.room_id WHERE link.entry_id=entry.id ORDER BY room.name) END AS rooms,
        COALESCE(exception.note, entry.note) AS note, exception.kind AS change_kind, exception.reason AS change_reason,
        FALSE AS cancelled, exception.original_date::TEXT AS original_date, exception.new_date::TEXT AS new_date
      FROM schedule_exceptions exception
      JOIN schedule_entries entry ON entry.id=exception.base_entry_id
      JOIN disciplines discipline ON discipline.id=entry.discipline_id
      JOIN schedule_lesson_types lesson_type ON lesson_type.id=entry.lesson_type_id
      LEFT JOIN disciplines changed_discipline ON changed_discipline.id=exception.discipline_id
      LEFT JOIN schedule_lesson_types changed_type ON changed_type.id=exception.lesson_type_id
      JOIN class_periods period ON period.id=COALESCE(exception.class_period_id, entry.class_period_id)
      WHERE exception.status='active' AND exception.kind IN ('move','reschedule') AND exception.new_date=${date}
        AND exception.original_date<>${date}
        AND (${groupId}::UUID IS NULL OR (
          (EXISTS (SELECT 1 FROM schedule_exception_groups WHERE exception_id=exception.id)
            AND EXISTS (SELECT 1 FROM schedule_exception_groups WHERE exception_id=exception.id AND group_id=${groupId}::UUID))
          OR (NOT EXISTS (SELECT 1 FROM schedule_exception_groups WHERE exception_id=exception.id)
            AND EXISTS (SELECT 1 FROM schedule_entry_groups WHERE entry_id=entry.id AND group_id=${groupId}::UUID))))
        AND (${teacherId}::UUID IS NULL
          OR NOT EXISTS (SELECT 1 FROM teachers selected_teacher WHERE selected_teacher.id=${teacherId}::UUID AND selected_teacher.is_active)
          OR (
          (EXISTS (SELECT 1 FROM schedule_exception_teachers WHERE exception_id=exception.id)
            AND EXISTS (SELECT 1 FROM schedule_exception_teachers WHERE exception_id=exception.id AND teacher_id=${teacherId}::UUID))
          OR (NOT EXISTS (SELECT 1 FROM schedule_exception_teachers WHERE exception_id=exception.id)
            AND EXISTS (SELECT 1 FROM schedule_entry_teachers WHERE entry_id=entry.id AND teacher_id=${teacherId}::UUID))))
    ` as unknown as Promise<PublicRow[]>,
    sql`
      SELECT exception.id, exception.original_date::TEXT AS occurrence_date, period.number AS period_number,
        COALESCE(exception.custom_start_time, MAKE_TIME(period.start_minute/60, period.start_minute%60, 0))::TEXT AS start_time,
        COALESCE(exception.custom_end_time, MAKE_TIME(period.end_minute/60, period.end_minute%60, 0))::TEXT AS end_time,
        discipline.name AS discipline, lesson_type.name AS lesson_type, lesson_type.color AS lesson_type_color,
        ARRAY(SELECT group_item.code FROM schedule_exception_groups link JOIN academic_groups group_item ON group_item.id=link.group_id WHERE link.exception_id=exception.id ORDER BY group_item.code) AS groups,
        ARRAY(SELECT teacher.display_name FROM schedule_exception_teachers link JOIN teachers teacher ON teacher.id=link.teacher_id WHERE link.exception_id=exception.id ORDER BY teacher.display_name) AS teachers,
        ARRAY(SELECT room.name FROM schedule_exception_rooms link JOIN schedule_rooms room ON room.id=link.room_id WHERE link.exception_id=exception.id ORDER BY room.name) AS rooms,
        exception.note, exception.kind AS change_kind, exception.reason AS change_reason, FALSE AS cancelled,
        NULL::TEXT AS original_date, NULL::TEXT AS new_date, exception.source_kind
      FROM schedule_exceptions exception
      JOIN disciplines discipline ON discipline.id=exception.discipline_id
      JOIN schedule_lesson_types lesson_type ON lesson_type.id=exception.lesson_type_id
      JOIN class_periods period ON period.id=exception.class_period_id
      WHERE exception.status='active' AND exception.kind='one_time' AND exception.original_date=${date}
        AND exception.source_kind IS DISTINCT FROM 'teacher_schedule_json'
        AND (${groupId}::UUID IS NULL OR EXISTS (SELECT 1 FROM schedule_exception_groups WHERE exception_id=exception.id AND group_id=${groupId}::UUID))
        AND (${teacherId}::UUID IS NULL
          OR NOT EXISTS (SELECT 1 FROM teachers selected_teacher WHERE selected_teacher.id=${teacherId}::UUID AND selected_teacher.is_active)
          OR EXISTS (SELECT 1 FROM schedule_exception_teachers WHERE exception_id=exception.id AND teacher_id=${teacherId}::UUID))
    ` as unknown as Promise<PublicRow[]>,
    sql`
      SELECT exception.id, ${date}::DATE::TEXT AS occurrence_date, period.number AS period_number,
        COALESCE(exception.custom_start_time, MAKE_TIME(period.start_minute/60, period.start_minute%60, 0))::TEXT AS start_time,
        COALESCE(exception.custom_end_time, MAKE_TIME(period.end_minute/60, period.end_minute%60, 0))::TEXT AS end_time,
        discipline.name AS discipline, lesson_type.name AS lesson_type, lesson_type.color AS lesson_type_color,
        ARRAY(SELECT group_item.code FROM schedule_exception_groups link JOIN academic_groups group_item ON group_item.id=link.group_id WHERE link.exception_id=exception.id ORDER BY group_item.code) AS groups,
        ARRAY(SELECT teacher.display_name FROM schedule_exception_teachers link JOIN teachers teacher ON teacher.id=link.teacher_id WHERE link.exception_id=exception.id ORDER BY teacher.display_name) AS teachers,
        ARRAY(SELECT room.name FROM schedule_exception_rooms link JOIN schedule_rooms room ON room.id=link.room_id WHERE link.exception_id=exception.id ORDER BY room.name) AS rooms,
        NULL::TEXT AS note, NULL::TEXT AS change_kind, NULL::TEXT AS change_reason,
        FALSE AS cancelled, NULL::TEXT AS original_date, NULL::TEXT AS new_date
      FROM schedule_exceptions exception
      JOIN disciplines discipline ON discipline.id=exception.discipline_id
      JOIN schedule_lesson_types lesson_type ON lesson_type.id=exception.lesson_type_id
      JOIN class_periods period ON period.id=exception.class_period_id
      CROSS JOIN LATERAL get_schedule_day(exception.original_date) source_context
      WHERE exception.status='active' AND exception.kind='one_time'
        AND exception.source_kind='teacher_schedule_json'
        AND exception.original_date<=${date}::DATE
        AND ${date}::DATE<=MAKE_DATE(EXTRACT(YEAR FROM exception.original_date)::INTEGER, 12, 31)
        AND source_context.calendar_day=${weekday}
        AND source_context.week_type=${weekType}
        AND NOT source_context.is_makeup
        AND NOT EXISTS (
          SELECT 1 FROM schedule_entries migrated
          WHERE migrated.source_kind=exception.source_kind AND migrated.source_id=exception.source_id
        )
        AND (${groupId}::UUID IS NULL OR EXISTS (SELECT 1 FROM schedule_exception_groups WHERE exception_id=exception.id AND group_id=${groupId}::UUID))
        AND (${teacherId}::UUID IS NULL
          OR NOT EXISTS (SELECT 1 FROM teachers selected_teacher WHERE selected_teacher.id=${teacherId}::UUID AND selected_teacher.is_active)
          OR EXISTS (SELECT 1 FROM schedule_exception_teachers WHERE exception_id=exception.id AND teacher_id=${teacherId}::UUID))
    ` as unknown as Promise<PublicRow[]>,
  ]);
  const visibleBaseRows = baseRows.filter((row) => shouldShowBaseOccurrence({ exceptionKind: row.change_kind, selectedDate: date, newDate: row.new_date }));
  const items = mapRows([...visibleBaseRows, ...movedRows, ...oneTimeRows, ...legacyImportedRows])
    .sort((a,b) => a.startTime.localeCompare(b.startTime) || a.discipline.localeCompare(b.discipline, "uk"));
  return {
    date,
    calendarDayOfWeek: context.calendarDayOfWeek,
    scheduleDayOfWeek: context.dayOfWeek,
    weekType,
    weekConfigured: context.weekType !== null,
    isTransfer: context.isOverride,
    items,
  };
}

export async function getPublicScheduleWeek(input: {
  date?: string;
  groupId?: string | null;
  teacherId?: string | null;
}): Promise<PublicScheduleDay[]> {
  const selected = validDate(input.date);
  const value = new Date(`${selected}T00:00:00Z`);
  const offset = (value.getUTCDay() + 6) % 7;
  const monday = new Date(value.getTime() - offset * 86_400_000);
  return Promise.all(Array.from({ length: 7 }, (_, index) => getPublicScheduleDay({
    date: new Date(monday.getTime() + index * 86_400_000).toISOString().slice(0, 10),
    groupId: input.groupId,
    teacherId: input.teacherId,
  })));
}
