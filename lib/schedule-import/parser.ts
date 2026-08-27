import type { LessonWeekType } from "@/lib/schedule-week/rules";

export type ScheduleImportRow = Readonly<{
  rowNumber: number;
  subjectName: string;
  roomName: string;
  dayOfWeek: number;
  periodNumber: number;
  weekType: LessonWeekType;
}>;

export type ScheduleImportParseResult =
  | Readonly<{ ok: true; rows: ScheduleImportRow[] }>
  | Readonly<{ ok: false; errors: string[] }>;

type RawRow = Record<string, unknown>;

const MAX_IMPORT_ROWS = 200;
const FIELD_ALIASES = {
  subject: ["subject", "subjectname", "предмет", "назва предмета"],
  room: ["room", "roomname", "аудиторія", "аудитория"],
  day: ["day", "dayofweek", "день", "день тижня"],
  period: ["period", "periodnumber", "pair", "пара", "номер пари"],
  weekType: ["weektype", "week", "тиждень", "тип тижня"],
} as const;

const DAY_VALUES = new Map<string, number>([
  ["1", 1],
  ["monday", 1],
  ["понеділок", 1],
  ["2", 2],
  ["tuesday", 2],
  ["вівторок", 2],
  ["3", 3],
  ["wednesday", 3],
  ["середа", 3],
  ["4", 4],
  ["thursday", 4],
  ["четвер", 4],
  ["5", 5],
  ["friday", 5],
  ["п’ятниця", 5],
  ["п'ятниця", 5],
  ["пятниця", 5],
  ["6", 6],
  ["saturday", 6],
  ["субота", 6],
  ["7", 7],
  ["sunday", 7],
  ["неділя", 7],
]);

const WEEK_TYPE_VALUES = new Map<string, LessonWeekType>([
  ["numerator", "numerator"],
  ["чисельник", "numerator"],
  ["denominator", "denominator"],
  ["знаменник", "denominator"],
  ["both", "both"],
  ["обидва", "both"],
  ["обидва тижні", "both"],
]);

function normalizeText(value: unknown): string {
  return typeof value === "string"
    ? value.trim().replace(/\s+/gu, " ")
    : typeof value === "number"
      ? String(value)
      : "";
}

function normalizeKey(value: string): string {
  return value.replace(/^\uFEFF/u, "").trim().toLocaleLowerCase("uk-UA");
}

function readField(row: RawRow, aliases: readonly string[]): unknown {
  const normalized = new Map(
    Object.entries(row).map(([key, value]) => [normalizeKey(key), value]),
  );

  for (const alias of aliases) {
    if (normalized.has(alias)) return normalized.get(alias);
  }

  return undefined;
}

function countDelimiter(line: string, delimiter: string): number {
  let count = 0;
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    if (line[index] === '"') {
      if (quoted && line[index + 1] === '"') index += 1;
      else quoted = !quoted;
    } else if (!quoted && line[index] === delimiter) {
      count += 1;
    }
  }

  return count;
}

function parseCsvCells(content: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];

    if (character === '"') {
      if (quoted && content[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === delimiter && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && content[index + 1] === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }

  if (quoted) throw new Error("У CSV є незакрита лапка.");

  row.push(cell);
  if (row.some((value) => value.trim() !== "")) rows.push(row);
  return rows;
}

function parseCsv(content: string): RawRow[] {
  const firstLine = content.split(/\r?\n/u, 1)[0] ?? "";
  const delimiter = countDelimiter(firstLine, ";") > countDelimiter(firstLine, ",")
    ? ";"
    : ",";
  const rows = parseCsvCells(content, delimiter);

  if (rows.length < 2) {
    throw new Error("CSV має містити заголовки та щонайменше один рядок даних.");
  }

  const headers = rows[0].map(normalizeKey);
  return rows.slice(1).map((cells) =>
    Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""])),
  );
}

function parseJson(content: string): RawRow[] {
  let value: unknown;

  try {
    value = JSON.parse(content);
  } catch {
    throw new Error("JSON має некоректний синтаксис.");
  }
  if (!Array.isArray(value)) {
    throw new Error("JSON має містити масив занять.");
  }

  if (value.some((row) => !row || typeof row !== "object" || Array.isArray(row))) {
    throw new Error("Кожен елемент JSON має бути об’єктом заняття.");
  }

  return value as RawRow[];
}

function normalizeRow(row: RawRow, rowNumber: number): ScheduleImportRow | string[] {
  const errors: string[] = [];
  const subjectName = normalizeText(readField(row, FIELD_ALIASES.subject));
  const roomName = normalizeText(readField(row, FIELD_ALIASES.room));
  const dayValue = normalizeText(readField(row, FIELD_ALIASES.day)).toLocaleLowerCase("uk-UA");
  const periodValue = normalizeText(readField(row, FIELD_ALIASES.period));
  const weekValue = normalizeText(readField(row, FIELD_ALIASES.weekType)).toLocaleLowerCase("uk-UA");
  const dayOfWeek = DAY_VALUES.get(dayValue);
  const periodNumber = Number(periodValue);
  const weekType = WEEK_TYPE_VALUES.get(weekValue);

  if (subjectName.length < 2 || subjectName.length > 200) {
    errors.push(`Рядок ${rowNumber}: вкажіть коректний предмет.`);
  }
  if (roomName.length < 1 || roomName.length > 100) {
    errors.push(`Рядок ${rowNumber}: вкажіть коректну аудиторію.`);
  }
  if (!dayOfWeek) {
    errors.push(`Рядок ${rowNumber}: невідомий день тижня.`);
  }
  if (!Number.isInteger(periodNumber) || periodNumber < 1 || periodNumber > 99) {
    errors.push(`Рядок ${rowNumber}: номер пари має бути цілим числом від 1 до 99.`);
  }
  if (!weekType) {
    errors.push(`Рядок ${rowNumber}: тип тижня має бути «чисельник», «знаменник» або «обидва тижні».`);
  }

  if (errors.length > 0) return errors;

  return {
    rowNumber,
    subjectName,
    roomName,
    dayOfWeek: dayOfWeek as number,
    periodNumber,
    weekType: weekType as LessonWeekType,
  };
}

function weeksOverlap(first: LessonWeekType, second: LessonWeekType): boolean {
  return first === "both" || second === "both" || first === second;
}

function findInternalConflicts(rows: ScheduleImportRow[]): string[] {
  const errors: string[] = [];

  for (let index = 0; index < rows.length; index += 1) {
    for (let previous = 0; previous < index; previous += 1) {
      const currentRow = rows[index];
      const previousRow = rows[previous];

      if (
        currentRow.dayOfWeek === previousRow.dayOfWeek &&
        currentRow.periodNumber === previousRow.periodNumber &&
        weeksOverlap(currentRow.weekType, previousRow.weekType)
      ) {
        errors.push(
          `Рядок ${currentRow.rowNumber}: заняття конфліктує з рядком ${previousRow.rowNumber} за днем, парою та типом тижня.`,
        );
        break;
      }
    }
  }

  return errors;
}

export function parseScheduleImport(input: {
  fileName: string;
  content: string;
}): ScheduleImportParseResult {
  const extension = input.fileName.split(".").pop()?.toLocaleLowerCase("en-US");
  let rawRows: RawRow[];

  try {
    if (extension === "json") rawRows = parseJson(input.content);
    else if (extension === "csv") rawRows = parseCsv(input.content);
    else return { ok: false, errors: ["Підтримуються лише файли JSON і CSV."] };
  } catch (error) {
    return {
      ok: false,
      errors: [error instanceof Error ? error.message : "Не вдалося прочитати файл."],
    };
  }

  if (rawRows.length === 0) {
    return { ok: false, errors: ["Файл не містить занять."] };
  }
  if (rawRows.length > MAX_IMPORT_ROWS) {
    return {
      ok: false,
      errors: [`За один раз можна імпортувати не більше ${MAX_IMPORT_ROWS} занять.`],
    };
  }

  const rows: ScheduleImportRow[] = [];
  const errors: string[] = [];

  rawRows.forEach((rawRow, index) => {
    const normalized = normalizeRow(rawRow, index + 1);
    if (Array.isArray(normalized)) errors.push(...normalized);
    else rows.push(normalized);
  });

  if (errors.length > 0) return { ok: false, errors };

  const conflictErrors = findInternalConflicts(rows);
  return conflictErrors.length > 0
    ? { ok: false, errors: conflictErrors }
    : { ok: true, rows };
}
