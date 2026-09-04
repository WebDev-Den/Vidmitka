import type { Field, ObjectContract } from "./contracts";

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string, public readonly details?: unknown) {
    super(message);
  }
}
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value) || value.startsWith("0000")) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
export function validUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
}
function validField(value: unknown, field: Field): boolean {
  if (value === null) return field.nullable === true;
  if (field.type === "string") {
    return typeof value === "string"
      && (field.minLength === undefined || value.trim().length >= field.minLength)
      && (field.maxLength === undefined || value.length <= field.maxLength)
      && (!field.format || (field.format === "uuid" ? validUuid(value) : validDate(value)))
      && (!field.enum || field.enum.includes(value))
      && (!field.pattern || new RegExp(field.pattern, "u").test(value));
  }
  if (field.type === "integer") return typeof value === "number" && Number.isSafeInteger(value)
    && (field.minimum === undefined || value >= field.minimum) && (field.maximum === undefined || value <= field.maximum);
  if (field.type === "boolean") return typeof value === "boolean";
  return Array.isArray(value) && value.length >= (field.minItems ?? 0) && value.length <= (field.maxItems ?? 250)
    && value.every((item) => field.items && validField(item, field.items));
}
export function validateObject(value: unknown, contract: ObjectContract): Record<string, unknown> {
  if (!isRecord(value)) throw new ApiError(400, "INVALID_BODY", "Тіло запиту має бути JSON-об’єктом.");
  const invalid = Object.keys(value).filter((key) => !Object.hasOwn(contract.properties, key) || !validField(value[key], contract.properties[key]));
  invalid.push(...contract.required.filter((key) => !Object.hasOwn(value, key)));
  if (invalid.length) throw new ApiError(422, "INVALID_FIELDS", "Перевірте поля запиту.", { fields: [...new Set(invalid)] });
  return value;
}
export function toFormData(value: Record<string, unknown>): FormData {
  const form = new FormData();
  for (const [key, field] of Object.entries(value)) {
    if (field === null || field === undefined) continue;
    if (Array.isArray(field)) for (const item of field) form.append(key, String(item));
    else form.set(key, String(field));
  }
  return form;
}
export async function readJson(request: Request, maxBytes = 64 * 1024): Promise<unknown> {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    throw new ApiError(415, "UNSUPPORTED_MEDIA_TYPE", "Використовуйте Content-Type: application/json.");
  }
  if (Number(request.headers.get("content-length")) > maxBytes) throw new ApiError(413, "BODY_TOO_LARGE", "Запит завеликий.");
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "INVALID_JSON", "JSON відсутній.");
  let size = 0;
  const parts: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new ApiError(413, "BODY_TOO_LARGE", "Запит завеликий.");
      }
      parts.push(value);
    }
  } finally { reader.releaseLock(); }
  const data = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) { data.set(part, offset); offset += part.byteLength; }
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(data)); }
  catch { throw new ApiError(400, "INVALID_JSON", "Некоректний JSON."); }
}
export function queryParams(url: URL, allowed: readonly string[]): URLSearchParams {
  for (const key of url.searchParams.keys()) {
    if (!allowed.includes(key) || url.searchParams.getAll(key).length !== 1) throw new ApiError(400, "INVALID_QUERY", `Некоректний параметр: ${key}.`);
  }
  return url.searchParams;
}
export function positiveInteger(value: string | null, fallback: number, maximum: number, minimum = 0): number {
  if (value === null) return fallback;
  if (!/^\d+$/u.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < minimum || Number(value) > maximum) {
    throw new ApiError(400, "INVALID_QUERY", "Некоректне ціле число параметра.");
  }
  return Number(value);
}
