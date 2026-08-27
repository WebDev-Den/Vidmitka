export const MAX_STUDENT_IMPORT_BYTES = 512 * 1024;
export const MAX_STUDENT_IMPORT_ROWS = 500;
export type StudentImportRow = { fullName: string; groupName: string; subgroup: string | null };
type ParseResult = { ok: true; rows: StudentImportRow[] } | { ok: false; errors: string[] };

function csvRecords(content: string): Record<string, unknown>[] {
  const header = content.split(/\r?\n/u, 1)[0];
  const delimiter = header.includes(";") ? ";" : ",";
  const records: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let closed = false;
  for (let i = 0; i <= content.length; i++) {
    const char = content[i];
    if (quoted) {
      if (char === undefined) throw new Error("У CSV є незакрита лапка.");
      if (char === '"') {
        if (content[i + 1] === '"') { cell += '"'; i++; }
        else { quoted = false; closed = true; }
      } else cell += char;
    } else if (char === delimiter || char === "\n" || char === "\r" || char === undefined) {
      row.push(cell); cell = ""; closed = false;
      if (char !== delimiter) {
        if (row.some((value) => value.trim())) records.push(row);
        row = [];
        if (char === "\r" && content[i + 1] === "\n") i++;
      }
    } else if (char === '"' && cell === "" && !closed) quoted = true;
    else if (closed || char === '"') throw new Error("Некоректні лапки у CSV.");
    else cell += char;
  }
  if (records.length < 2) throw new Error("CSV має містити заголовки й студентів.");
  const headers = records[0].map((value) => value.trim().toLocaleLowerCase("uk-UA"));
  if (headers.some((value) => !value) || new Set(headers).size !== headers.length) {
    throw new Error("Заголовки CSV мають бути непорожніми та унікальними.");
  }
  return records.slice(1).map((cells, index) => {
    if (cells.length !== headers.length) throw new Error(`Рядок ${index + 1}: кількість колонок не відповідає заголовкам.`);
    return Object.fromEntries(headers.map((name, i) => [name, cells[i]]));
  });
}

function field(row: Record<string, unknown>, keys: string[]) {
  const normalized = new Map(Object.entries(row).map(([key, value]) => [key.trim().toLocaleLowerCase("uk-UA"), value]));
  return keys.map((key) => normalized.get(key)).find((value) => value !== undefined);
}
const clean = (value: unknown) => typeof value === "string" ? value.trim().replace(/\s+/gu, " ") : "";

export function parseStudentImport(fileName: string, source: string): ParseResult {
  const errors: string[] = [];
  try {
    if (new TextEncoder().encode(source).length > MAX_STUDENT_IMPORT_BYTES) throw new Error("Максимальний розмір файлу — 512 КБ.");
    const content = source.replace(/^\uFEFF/u, "");
    if (content.includes("\uFFFD")) throw new Error("Збережіть файл у кодуванні UTF-8 і повторіть імпорт.");
    const extension = fileName.split(".").pop()?.toLowerCase();
    let raw: unknown;
    if (extension === "csv") raw = csvRecords(content);
    else if (extension === "json") {
      try { raw = JSON.parse(content); } catch { throw new Error("JSON має некоректний синтаксис."); }
    } else throw new Error("Підтримуються лише файли CSV та JSON.");
    if (!Array.isArray(raw) || !raw.length) throw new Error("Файл має містити непорожній список студентів.");
    if (raw.length > MAX_STUDENT_IMPORT_ROWS) throw new Error("За один раз можна імпортувати максимум 500 студентів.");
    const seen = new Map<string, number>();
    const rows: StudentImportRow[] = [];
    raw.forEach((item: unknown, index) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        errors.push(`Рядок ${index + 1}: очікується об’єкт студента.`); return;
      }
      const record = item as Record<string, unknown>;
      const fullName = clean(field(record, ["fullname", "піб", "піб студента"]));
      const groupName = clean(field(record, ["groupname", "group", "група"]));
      const rawSubgroup = field(record, ["subgroup", "підгрупа"]);
      const subgroup = rawSubgroup === undefined ? null : clean(rawSubgroup);
      if (fullName.length < 3 || fullName.length > 200) errors.push(`Рядок ${index + 1}: ПІБ має містити 3–200 символів.`);
      if (groupName.length < 2 || groupName.length > 100) errors.push(`Рядок ${index + 1}: група має містити 2–100 символів.`);
      if (rawSubgroup !== undefined && (typeof rawSubgroup !== "string" || subgroup!.length > 100)) errors.push(`Рядок ${index + 1}: підгрупа має бути текстом до 100 символів.`);
      const key = JSON.stringify([fullName.toLocaleLowerCase("uk-UA"), groupName.toLocaleLowerCase("uk-UA")]);
      if (seen.has(key)) errors.push(`Рядок ${index + 1}: студент повторює рядок ${seen.get(key)}.`);
      seen.set(key, index + 1);
      rows.push({ fullName, groupName, subgroup });
    });
    return errors.length ? { ok: false, errors: errors.slice(0, 20) } : { ok: true, rows };
  } catch (error) {
    return { ok: false, errors: [error instanceof Error ? error.message : "Не вдалося прочитати файл."] };
  }
}
