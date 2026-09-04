/** Portable schedule-only format. SQL identifiers come exclusively from this registry. */
export type Value = string | number | boolean | null | string[];
export type TransferRow = Record<string, Value>;
type Field = { type: "text" | "uuid" | "date" | "time" | "integer" | "boolean";
  nullable?: boolean; min?: number; max?: number; values?: readonly string[]; pattern?: RegExp;
  ref?: string; normalized?: string };
export type Definition = { table: string; label: string; key: string; fields: Record<string, Field>;
  actor?: boolean; links?: Record<string, { table: string; parent: string; column: string; ref: string }> };
const text = (min = 0, max = 500, nullable = false): Field => ({ type: "text", min, max, nullable });
const integer = (min: number, max: number, nullable = false): Field => ({ type: "integer", min, max, nullable });
const choice = (values: readonly string[], nullable = false): Field => ({ type: "text", values, nullable });
const uuid = (ref?: string, nullable = false): Field => ({ type: "uuid", ref, nullable });
const date = (nullable = false): Field => ({ type: "date", nullable });
const active: Field = { type: "boolean" };
const color: Field = { type: "text", pattern: /^#[0-9a-f]{6}$/iu };
const week = ["numerator", "denominator"];
const source = { source_kind: text(0, 200, true), source_id: text(0, 500, true), source_payload_hash: text(0, 200, true) };
const links = (kind: "entry" | "exception") => Object.fromEntries([
  ["group", "groups"], ["teacher", "teachers"], ["room", "rooms"],
].map(([singular, plural]) => [`${singular}_ids`, {
  table: `schedule_${kind}_${plural}`, parent: `${kind}_id`, column: `${singular}_id`, ref: plural,
}]));

export const definitions: Record<string, Definition> = {
  groups: { table: "academic_groups", label: "Групи", key: "id", fields: {
    id: uuid(), code: { ...text(1, 100), normalized: "code_normalized" }, faculty: text(0, 500, true),
    course: integer(1, 12, true), study_form: text(0, 500, true), is_active: active,
  } },
  teachers: { table: "teachers", label: "Викладачі", key: "id", fields: {
    id: uuid(), display_name: { ...text(2, 200), normalized: "display_name_normalized" },
    last_name: text(0, 500, true), first_name: text(0, 500, true), middle_name: text(0, 500, true),
    short_name: text(0, 500, true), department: text(0, 500, true), is_active: active,
  } },
  disciplines: { table: "disciplines", label: "Дисципліни", key: "id", fields: {
    id: uuid(), name: { ...text(2, 300), normalized: "name_normalized" }, short_name: text(1, 100, true),
    internal_code: text(1, 100, true), is_active: active,
  } },
  rooms: { table: "schedule_rooms", label: "Аудиторії", key: "id", fields: {
    id: uuid(), name: { ...text(1, 120), normalized: "name_normalized" }, building: text(0, 500, true),
    description: text(0, 2000, true), room_type: text(0, 500, true),
    delivery_mode: choice(["physical", "remote", "unspecified"]), is_active: active,
  } },
  lessonTypes: { table: "schedule_lesson_types", label: "Типи занять", key: "id", fields: {
    id: uuid(), name: { ...text(2, 100), normalized: "name_normalized" }, short_name: text(1, 40, true), color, is_active: active,
  } },
  periods: { table: "class_periods", label: "Пари та час", key: "number", fields: {
    number: integer(1, 99), start_minute: integer(0, 1439), end_minute: integer(1, 1440), is_active: active, color,
  } },
  entries: { table: "schedule_entries", label: "Заняття", key: "id", actor: true, fields: {
    id: uuid(), discipline_id: uuid("disciplines"), lesson_type_id: uuid("lessonTypes"),
    period_number: { ...integer(1, 99), ref: "periods" }, day_of_week: integer(1, 7),
    week_pattern: choice([...week, "both"]), valid_from: date(true), valid_until: date(true),
    note: text(0, 500, true), is_active: active, ...source,
  }, links: links("entry") },
  exceptions: { table: "schedule_exceptions", label: "Переноси та винятки", key: "id", actor: true, fields: {
    id: uuid(), base_entry_id: uuid("entries", true),
    kind: choice(["move", "reschedule", "room_change", "teacher_change", "discipline_change", "type_change", "cancel", "one_time"]),
    original_date: date(), new_date: date(true), period_number: { ...integer(1, 99, true), ref: "periods" },
    custom_start_time: { type: "time", nullable: true }, custom_end_time: { type: "time", nullable: true },
    discipline_id: uuid("disciplines", true), lesson_type_id: uuid("lessonTypes", true),
    source_schedule_day: integer(1, 7, true), source_schedule_week: choice(week, true),
    reason: text(0, 500, true), note: text(0, 500, true), status: choice(["active", "superseded", "cancelled"]), ...source,
  }, links: links("exception") },
  calendar: { table: "makeup_days", label: "Календар відпрацювань", key: "held_on", actor: true, fields: {
    held_on: date(), schedule_day: integer(1, 7), week_type: choice(week), is_active: active,
  } },
  weeks: { table: "schedule_week_settings", label: "Навчальні тижні", key: "id", fields: {
    id: integer(1, 1), anchor_date: date(), anchor_week_type: choice(week), semester_start: date(true), semester_end: date(true),
  } },
};

export type TransferData = Record<string, TransferRow[]>;
export type ScheduleSnapshot = { format: "vidmitka-schedule"; version: 1; exportedAt: string; data: TransferData };
export class SnapshotFormatError extends Error {}
export const MAX_TRANSFER_BYTES = 3 * 1024 * 1024;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
export const normalizeName = (value: Value) => String(value).normalize("NFC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("uk-UA");
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);

function valid(value: unknown, field: Field): boolean {
  if (value === null) return Boolean(field.nullable);
  if (field.type === "boolean") return typeof value === "boolean";
  if (field.type === "integer") return typeof value === "number" && Number.isInteger(value) && value >= field.min! && value <= field.max!;
  if (typeof value !== "string" || value.includes("\0")) return false;
  if (field.type === "uuid") return uuidPattern.test(value);
  if (field.type === "date") return /^\d{4}-\d{2}-\d{2}$/u.test(value) && value >= "0001-01-01" &&
    Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
  if (field.type === "time") return /^([01]\d|2[0-3]):[0-5]\d:[0-5]\d(\.\d{1,6})?$/u.test(value);
  return (field.min === undefined || value.length >= field.min) && (field.max === undefined || value.length <= field.max) &&
    (!field.pattern || field.pattern.test(value)) && (!field.values || field.values.includes(value)) &&
    (!field.normalized || value === value.trim());
}

export function parseSnapshot(value: unknown): ScheduleSnapshot {
  if (!object(value) || value.format !== "vidmitka-schedule" || value.version !== 1 || !object(value.data) ||
    Object.keys(value).some((key) => !["format", "version", "exportedAt", "data"].includes(key)) ||
    typeof value.exportedAt !== "string" || !Number.isFinite(Date.parse(value.exportedAt))) {
    throw new SnapshotFormatError("Невідомий формат експорту. Потрібен vidmitka-schedule версії 1.");
  }
  if (Object.keys(value.data).some((key) => !Object.hasOwn(definitions, key))) throw new SnapshotFormatError("Файл містить невідомий розділ.");
  const data: TransferData = {};
  let total = 0;
  for (const [key, definition] of Object.entries(definitions)) {
    const rows = value.data[key];
    if (!Array.isArray(rows) || (total += rows.length) > 15000) throw new SnapshotFormatError(`Розділ «${definition.label}» відсутній або файл перевищує 15 000 записів.`);
    const seen = new Set<string>();
    data[key] = rows.map((row, index) => {
      const fail = () => new SnapshotFormatError(`${definition.label}, запис ${index + 1}: некоректні, зайві або пропущені поля.`);
      if (!object(row) || Object.keys(row).some((name) => !Object.hasOwn(definition.fields, name) && !Object.hasOwn(definition.links ?? {}, name))) throw fail();
      const clean: TransferRow = {};
      for (const [name, field] of Object.entries(definition.fields)) {
        if (!valid(row[name], field)) throw fail();
        clean[name] = field.type === "uuid" && typeof row[name] === "string" ? row[name].toLowerCase() : row[name] as Value;
      }
      for (const name of Object.keys(definition.links ?? {})) {
        const ids = row[name];
        if (!Array.isArray(ids) || ids.length > 500 || ids.some((id) => typeof id !== "string" || !uuidPattern.test(id))) throw fail();
        const uniqueIds = [...new Set((ids as string[]).map((id) => id.toLowerCase()))].sort();
        if (uniqueIds.length !== ids.length) throw fail();
        clean[name] = uniqueIds;
      }
      const id = String(clean[definition.key]);
      if (seen.has(id)) throw new SnapshotFormatError(`${definition.label}: повторний ідентифікатор ${id}.`);
      seen.add(id);
      return clean;
    });
  }
  return { format: "vidmitka-schedule", version: 1, exportedAt: value.exportedAt, data };
}

export function equalRows(a: TransferRow, b: TransferRow): boolean {
  return Object.keys(a).length === Object.keys(b).length && Object.keys(a).every((key) => {
    const left = a[key], right = b[key];
    return Array.isArray(left) && Array.isArray(right)
      ? JSON.stringify([...left].sort()) === JSON.stringify([...right].sort()) : left === right;
  });
}
