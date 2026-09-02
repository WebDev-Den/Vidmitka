import { createHash } from "node:crypto";

export type ImportWeekType = "numerator" | "denominator";

export type TeacherScheduleImportRow = Readonly<{
  rowNumber: number;
  sourceId: string;
  payloadHash: string;
  teacherName: string;
  validFrom: string;
  validUntil: string;
  dayOfWeek: number;
  periodNumber: number;
  weekPattern: ImportWeekType;
  disciplineName: string;
  roomName: string;
  groups: readonly string[];
  lessonTypeName: string;
  sourceScheduleDay: number;
  sourceScheduleWeek: ImportWeekType;
}>;

export type ImportIssue = Readonly<{
  rowNumber?: number;
  code: string;
  message: string;
  relatedRows?: readonly number[];
}>;

export type TeacherScheduleImportAnalysis =
  | Readonly<{ ok: false; errors: readonly ImportIssue[] }>
  | Readonly<{
      ok: true;
      rows: readonly TeacherScheduleImportRow[];
      errors: readonly ImportIssue[];
      warnings: readonly ImportIssue[];
      catalogs: Readonly<{
        teachers: readonly string[];
        disciplines: readonly string[];
        rooms: readonly string[];
        groups: readonly string[];
        lessonTypes: readonly string[];
      }>;
      summary: Readonly<{
        totalRows: number;
        validRows: number;
        invalidRows: number;
        duplicateRows: number;
        teachers: number;
        disciplines: number;
        rooms: number;
        groups: number;
        lessonTypes: number;
        warnings: number;
      }>;
    }>;

type RawObject = Record<string, unknown>;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const MAX_ROWS = 10_000;
const WEEK_TYPES = new Set<ImportWeekType>(["numerator", "denominator"]);

function normalizeText(value: unknown): string {
  return typeof value === "string"
    ? value.normalize("NFC").trim().replace(/\s+/gu, " ")
    : "";
}

function normalizedKey(value: string): string {
  return normalizeText(value).toLocaleLowerCase("uk-UA");
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function isObject(value: unknown): value is RawObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validDate(value: string): boolean {
  if (!DATE_PATTERN.test(value) || value.startsWith("0000-")) return false;
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

function isoDayOfWeek(value: string): number {
  const day = new Date(`${value}T00:00:00.000Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

function endOfYear(value: string): string {
  return `${value.slice(0, 4)}-12-31`;
}

function asInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function asWeekType(value: unknown): ImportWeekType | null {
  return typeof value === "string" && WEEK_TYPES.has(value as ImportWeekType)
    ? value as ImportWeekType
    : null;
}

function validateRow(raw: unknown, rowNumber: number):
  | Readonly<{ row: Omit<TeacherScheduleImportRow, "sourceId" | "payloadHash"> }>
  | Readonly<{ errors: readonly ImportIssue[] }> {
  if (!isObject(raw)) {
    return { errors: [{ rowNumber, code: "invalid_record", message: `Запис ${rowNumber} має бути об’єктом.` }] };
  }

  const errors: ImportIssue[] = [];
  const teacherName = normalizeText(raw.teacher);
  const validFrom = normalizeText(raw.date);
  const dayOfWeek = asInteger(raw.dayOfWeek);
  const periodNumber = asInteger(raw.period);
  const weekPattern = asWeekType(raw.weekType);
  const disciplineName = normalizeText(raw.subject);
  const roomName = normalizeText(raw.room);
  const lessonTypeName = normalizeText(raw.lessonType);
  const substitution = isObject(raw.substitution) ? raw.substitution : null;
  const sourceScheduleDay = asInteger(substitution?.dayOfWeek);
  const sourceScheduleWeek = asWeekType(substitution?.weekType);

  const groups = Array.isArray(raw.groups)
    ? [...new Map(raw.groups.map(normalizeText).filter(Boolean).map((group) => [normalizedKey(group), group])).values()]
      .sort((first, second) => first.localeCompare(second, "uk-UA"))
    : [];

  const requireText = (value: string, field: string, code: string, max: number) => {
    if (value.length < 1 || value.length > max) {
      errors.push({ rowNumber, code, message: `Запис ${rowNumber}: поле «${field}» має містити від 1 до ${max} символів.` });
    }
  };

  requireText(teacherName, "teacher", "invalid_teacher", 200);
  requireText(disciplineName, "subject", "invalid_subject", 300);
  requireText(roomName, "room", "invalid_room", 120);
  requireText(lessonTypeName, "lessonType", "invalid_lesson_type", 100);

  if (!validDate(validFrom)) {
    errors.push({ rowNumber, code: "invalid_date", message: `Запис ${rowNumber}: дата має формат YYYY-MM-DD.` });
  }
  if (dayOfWeek === null || dayOfWeek < 1 || dayOfWeek > 7) {
    errors.push({ rowNumber, code: "invalid_day", message: `Запис ${rowNumber}: dayOfWeek має бути числом від 1 до 7.` });
  } else if (validDate(validFrom) && isoDayOfWeek(validFrom) !== dayOfWeek) {
    errors.push({ rowNumber, code: "date_day_mismatch", message: `Запис ${rowNumber}: dayOfWeek не відповідає даті ${validFrom}.` });
  }
  if (periodNumber === null || periodNumber < 1 || periodNumber > 99) {
    errors.push({ rowNumber, code: "invalid_period", message: `Запис ${rowNumber}: period має бути цілим числом від 1 до 99.` });
  }
  if (!weekPattern) {
    errors.push({ rowNumber, code: "invalid_week_type", message: `Запис ${rowNumber}: weekType має бути numerator або denominator.` });
  }
  if (groups.length === 0) {
    errors.push({ rowNumber, code: "invalid_groups", message: `Запис ${rowNumber}: groups має містити щонайменше одну групу.` });
  }
  if (groups.some((group) => group.length > 100)) {
    errors.push({ rowNumber, code: "invalid_group", message: `Запис ${rowNumber}: код групи не може перевищувати 100 символів.` });
  }
  if (!substitution || sourceScheduleDay === null || sourceScheduleDay < 1 || sourceScheduleDay > 7) {
    errors.push({ rowNumber, code: "invalid_substitution_day", message: `Запис ${rowNumber}: substitution.dayOfWeek має бути числом від 1 до 7.` });
  }
  if (!sourceScheduleWeek) {
    errors.push({ rowNumber, code: "invalid_substitution_week", message: `Запис ${rowNumber}: substitution.weekType має бути numerator або denominator.` });
  }

  if (errors.length > 0) return { errors };

  return {
    row: {
      rowNumber,
      teacherName,
      validFrom,
      validUntil: endOfYear(validFrom),
      dayOfWeek: dayOfWeek as number,
      periodNumber: periodNumber as number,
      weekPattern: weekPattern as ImportWeekType,
      disciplineName,
      roomName,
      groups,
      lessonTypeName,
      sourceScheduleDay: sourceScheduleDay as number,
      sourceScheduleWeek: sourceScheduleWeek as ImportWeekType,
    },
  };
}

function identityPayload(row: Omit<TeacherScheduleImportRow, "rowNumber" | "sourceId" | "payloadHash">): string {
  return JSON.stringify({
    date: row.validFrom,
    period: row.periodNumber,
    teacher: normalizedKey(row.teacherName),
    groups: row.groups.map(normalizedKey).sort(),
    sourceDay: row.sourceScheduleDay,
    sourceWeek: row.sourceScheduleWeek,
  });
}

function normalizedPayload(row: Omit<TeacherScheduleImportRow, "rowNumber" | "sourceId" | "payloadHash">): string {
  return JSON.stringify({
    identity: JSON.parse(identityPayload(row)) as unknown,
    subject: normalizedKey(row.disciplineName),
    room: normalizedKey(row.roomName),
    lessonType: normalizedKey(row.lessonTypeName),
    calendarWeek: row.weekPattern,
    dayOfWeek: row.dayOfWeek,
  });
}

function addCollisionWarnings(
  rows: readonly TeacherScheduleImportRow[],
  warnings: ImportIssue[],
  code: string,
  label: string,
  keys: (row: TeacherScheduleImportRow) => readonly string[],
): void {
  const collisions = new Map<string, number[]>();
  for (const row of rows) {
    for (const key of keys(row)) {
      const bucket = collisions.get(key) ?? [];
      bucket.push(row.rowNumber);
      collisions.set(key, bucket);
    }
  }
  for (const relatedRows of collisions.values()) {
    if (relatedRows.length < 2) continue;
    warnings.push({
      rowNumber: relatedRows[0],
      relatedRows,
      code,
      message: `${label}: записи ${relatedRows.join(", ")} використовують один часовий слот.`,
    });
  }
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Map(values.map((value) => [normalizedKey(value), value])).values()]
    .sort((first, second) => first.localeCompare(second, "uk-UA"));
}

export function analyzeTeacherScheduleJson(content: string): TeacherScheduleImportAnalysis {
  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch {
    return { ok: false, errors: [{ code: "invalid_json", message: "JSON має некоректний синтаксис." }] };
  }
  if (!Array.isArray(raw)) {
    return { ok: false, errors: [{ code: "invalid_root", message: "Кореневе значення JSON має бути масивом занять." }] };
  }
  if (raw.length === 0) {
    return { ok: false, errors: [{ code: "empty_file", message: "JSON не містить занять." }] };
  }
  if (raw.length > MAX_ROWS) {
    return { ok: false, errors: [{ code: "too_many_rows", message: `JSON містить більше ${MAX_ROWS} записів.` }] };
  }

  const errors: ImportIssue[] = [];
  const warnings: ImportIssue[] = [];
  const rows: TeacherScheduleImportRow[] = [];
  const seen = new Map<string, number>();
  let duplicateRows = 0;

  raw.forEach((value, index) => {
    const rowNumber = index + 1;
    const validation = validateRow(value, rowNumber);
    if ("errors" in validation) {
      errors.push(...validation.errors);
      return;
    }
    const { rowNumber: _, ...withoutRowNumber } = validation.row;
    const sourceId = hash(identityPayload(withoutRowNumber));
    const firstRow = seen.get(sourceId);
    if (firstRow !== undefined) {
      duplicateRows += 1;
      warnings.push({
        rowNumber,
        relatedRows: [firstRow, rowNumber],
        code: "duplicate_row",
        message: `Запис ${rowNumber} дублює нормалізований запис ${firstRow} і буде пропущений.`,
      });
      return;
    }
    seen.set(sourceId, rowNumber);
    rows.push({ ...validation.row, sourceId, payloadHash: hash(normalizedPayload(withoutRowNumber)) });
  });

  addCollisionWarnings(rows, warnings, "teacher_conflict", "Можливий конфлікт викладача", (row) => [
    `${row.validFrom}|${row.periodNumber}|${normalizedKey(row.teacherName)}`,
  ]);
  addCollisionWarnings(rows, warnings, "room_conflict", "Можливий конфлікт аудиторії", (row) => [
    `${row.validFrom}|${row.periodNumber}|${normalizedKey(row.roomName)}`,
  ]);
  addCollisionWarnings(rows, warnings, "group_conflict", "Можливий конфлікт групи", (row) =>
    row.groups.map((group) => `${row.validFrom}|${row.periodNumber}|${normalizedKey(group)}`),
  );

  const catalogs = {
    teachers: uniqueSorted(rows.map((row) => row.teacherName)),
    disciplines: uniqueSorted(rows.map((row) => row.disciplineName)),
    rooms: uniqueSorted(rows.map((row) => row.roomName)),
    groups: uniqueSorted(rows.flatMap((row) => row.groups)),
    lessonTypes: uniqueSorted(rows.map((row) => row.lessonTypeName)),
  };

  return {
    ok: true,
    rows,
    errors,
    warnings,
    catalogs,
    summary: {
      totalRows: raw.length,
      validRows: rows.length,
      invalidRows: raw.length - rows.length - duplicateRows,
      duplicateRows,
      teachers: catalogs.teachers.length,
      disciplines: catalogs.disciplines.length,
      rooms: catalogs.rooms.length,
      groups: catalogs.groups.length,
      lessonTypes: catalogs.lessonTypes.length,
      warnings: warnings.length,
    },
  };
}
