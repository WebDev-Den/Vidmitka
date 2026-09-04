import "server-only";

import { listScheduleCatalog, createScheduleCatalogEntry, updateScheduleCatalogEntry, updateScheduleCatalogEntries, deleteScheduleCatalogEntry, setScheduleCatalogEntryActive } from "@/lib/schedule-v2/catalogs";
import { listScheduleEntries, createScheduleEntry, updateScheduleEntry, deleteScheduleEntry, setScheduleEntryActive } from "@/lib/schedule-v2/entries";
import { listScheduleExceptions, createScheduleException, updateScheduleException, deleteScheduleException } from "@/lib/schedule-v2/exceptions";
import { listClassPeriods, createClassPeriod, updateClassPeriod, updateClassPeriods, setClassPeriodActive, deleteClassPeriod } from "@/lib/class-periods/repository";
import { listCalendarOverrides, saveCalendarOverride, deleteCalendarOverride } from "@/lib/schedule-v2/calendar-overrides";
import { activationContract, collectionContract, isCatalog, type CollectionResource } from "./contracts";
import { ApiError, isRecord, positiveInteger, queryParams, readJson, toFormData, validDate, validUuid, validateObject } from "./http";

export type ApiResult = { data: unknown; status?: number; location?: string };
export type MutationResult = { success: boolean; message: string; id?: string };
type Row = Readonly<Record<string, unknown>>;

export function acceptMutation(result: MutationResult): void {
  if (!result.success) throw new ApiError(422, "RULE_REJECTED", result.message);
}

export async function listResource(resource: CollectionResource): Promise<readonly Row[]> {
  if (isCatalog(resource)) return listScheduleCatalog(resource);
  if (resource === "entries") return listScheduleEntries();
  if (resource === "exceptions") return listScheduleExceptions();
  if (resource === "periods") return listClassPeriods();
  return listCalendarOverrides();
}
function validateId(resource: CollectionResource, id: string): void {
  const valid = resource === "calendar-overrides" ? validDate(id) : resource === "periods" ? /^[1-9][0-9]{0,14}$/u.test(id) : validUuid(id);
  if (!valid) throw new ApiError(400, "INVALID_ID", "Некоректний ідентифікатор ресурсу.");
}
export async function getResource(resource: CollectionResource, id: string): Promise<Row> {
  validateId(resource, id);
  const row = (await listResource(resource)).find((item) => String(item.id ?? item.date) === id);
  if (!row) throw new ApiError(404, "NOT_FOUND", "Запис не знайдено.");
  return row;
}
function matchesRelation(row: Row, name: string, id: string): boolean {
  const values = row[name];
  return Array.isArray(values) && values.some((item) => item && typeof item === "object" && item.id === id);
}
async function getCollection(resource: CollectionResource, url: URL): Promise<ApiResult> {
  const relations = resource === "entries" || resource === "exceptions" ? ["teacherId", "groupId"] : [];
  const query = queryParams(url, ["limit", "offset", "q", "active", ...relations]);
  const limit = positiveInteger(query.get("limit"), 100, 200, 1);
  const offset = positiveInteger(query.get("offset"), 0, 1_000_000);
  const active = query.get("active");
  if (active !== null && active !== "true" && active !== "false") throw new ApiError(400, "INVALID_QUERY", "active має бути true або false.");
  for (const name of relations) {
    if (query.has(name) && !validUuid(query.get(name)!)) throw new ApiError(400, "INVALID_QUERY", `Некоректний ${name}.`);
  }
  const term = (query.get("q") ?? "").toLocaleLowerCase("uk-UA");
  const rows = (await listResource(resource)).filter((row) => {
    const isActive = typeof row.isActive === "boolean" ? row.isActive : row.status ? row.status === "active" : true;
    return (active === null || isActive === (active === "true"))
      && (!term || JSON.stringify(row).toLocaleLowerCase("uk-UA").includes(term))
      && (!query.has("teacherId") || matchesRelation(row, "teachers", query.get("teacherId")!))
      && (!query.has("groupId") || matchesRelation(row, "groups", query.get("groupId")!));
  }).sort((left, right) => String(left.id ?? left.date).localeCompare(String(right.id ?? right.date)));
  return { data: { items: rows.slice(offset, offset + limit), total: rows.length, limit, offset } };
}

async function writeResource(resource: CollectionResource, id: string | undefined, body: unknown, administratorId: string): Promise<MutationResult> {
  const value = validateObject(body, collectionContract(resource));
  const form = toFormData(value);
  if (isCatalog(resource)) return id ? updateScheduleCatalogEntry(resource, id, form) : createScheduleCatalogEntry(resource, form);
  if (resource === "entries") return id ? updateScheduleEntry(administratorId, id, form) : createScheduleEntry(administratorId, form);
  if (resource === "exceptions") return id ? updateScheduleException(administratorId, id, form) : createScheduleException(administratorId, form);
  if (resource === "periods") {
    const fields = { number: form.get("number"), startTime: form.get("startTime"), endTime: form.get("endTime"), color: form.get("color") };
    return id ? updateClassPeriod(id, fields) : createClassPeriod(fields);
  }
  if (!id) throw new ApiError(405, "METHOD_NOT_ALLOWED", "Календарну дату створюйте через PUT /calendar-overrides/YYYY-MM-DD із version: 0.");
  return saveCalendarOverride(administratorId, { date: id, dayOfWeek: form.get("dayOfWeek"), weekType: form.get("weekType"), version: form.get("version") });
}

async function removeResource(resource: CollectionResource, id: string, administratorId: string, url: URL): Promise<MutationResult> {
  if (resource === "calendar-overrides") {
    const query = queryParams(url, ["version"]);
    if (!query.has("version")) throw new ApiError(400, "VERSION_REQUIRED", "Вкажіть поточну version календарної дати.");
    const version = positiveInteger(query.get("version"), 0, Number.MAX_SAFE_INTEGER, 1);
    return deleteCalendarOverride(administratorId, { date: id, version: String(version) });
  }
  queryParams(url, []);
  if (isCatalog(resource)) return deleteScheduleCatalogEntry(resource, id);
  if (resource === "entries") return deleteScheduleEntry(id);
  if (resource === "exceptions") return deleteScheduleException(id);
  return deleteClassPeriod(id);
}

export async function handleCollection(request: Request, resource: CollectionResource, id: string | undefined, administratorId: string): Promise<ApiResult> {
  const method = request.method;
  const url = new URL(request.url);
  if (id === "batch" && (isCatalog(resource) || resource === "periods")) {
    if (method !== "PUT") throw new ApiError(405, "METHOD_NOT_ALLOWED", "Пакетне оновлення доступне через PUT.");
    queryParams(url, []);
    const body = await readJson(request);
    const maximum = resource === "periods" ? 99 : 25;
    if (!isRecord(body) || Object.keys(body).some((key) => key !== "changes") || !Array.isArray(body.changes) || !body.changes.length || body.changes.length > maximum) {
      throw new ApiError(422, "INVALID_FIELDS", `Потрібен масив changes від 1 до ${maximum} записів.`);
    }
    const contract = collectionContract(resource);
    const changes = body.changes.map((item) => validateObject(item, {
      properties: { ...contract.properties, id: resource === "periods" ? { type: "string", pattern: "^[1-9][0-9]{0,14}$" } : { type: "string", format: "uuid" } },
      required: ["id", ...contract.required],
    }));
    const result = resource === "periods"
      ? await updateClassPeriods(changes.map((change) => ({ id: String(change.id), number: String(change.number), startTime: String(change.startTime), endTime: String(change.endTime), color: String(change.color) })))
      : await updateScheduleCatalogEntries(resource, changes.map((change) => ({ id: String(change.id), name: String(change.name), ...(typeof change.color === "string" ? { color: change.color } : {}) })));
    acceptMutation(result);
    return { data: result };
  }
  if (method === "GET") {
    if (!id) return getCollection(resource, url);
    queryParams(url, []);
    return { data: await getResource(resource, id) };
  }
  if (id) validateId(resource, id);
  if (method === "POST" && !id && resource !== "calendar-overrides") {
    queryParams(url, []);
    const result = await writeResource(resource, undefined, await readJson(request), administratorId);
    acceptMutation(result);
    if (!result.id) throw new ApiError(500, "INTERNAL_ERROR", "Не вдалося отримати ідентифікатор створеного запису.");
    return { data: result, status: 201, location: `/api/v1/${resource}/${result.id}` };
  }
  if (method === "PUT" && id) {
    queryParams(url, []);
    const body = await readJson(request);
    // Calendar uses its atomic optimistic version check for both creation and updates.
    if (resource !== "calendar-overrides") await getResource(resource, id);
    const result = await writeResource(resource, id, body, administratorId);
    acceptMutation(result);
    return { data: { ...result, id } };
  }
  if (method === "DELETE" && id) {
    await getResource(resource, id);
    const result = await removeResource(resource, id, administratorId, url);
    acceptMutation(result);
    return { data: { ...result, id } };
  }
  if (method === "PATCH" && id && (isCatalog(resource) || resource === "entries" || resource === "periods")) {
    queryParams(url, []);
    const body = validateObject(await readJson(request), activationContract);
    await getResource(resource, id);
    const active = body.isActive as boolean;
    const result = isCatalog(resource) ? await setScheduleCatalogEntryActive(resource, id, active)
      : resource === "entries" ? await setScheduleEntryActive(administratorId, id, active) : await setClassPeriodActive(id, active);
    acceptMutation(result);
    return { data: { ...result, id } };
  }
  throw new ApiError(405, "METHOD_NOT_ALLOWED", "Метод не підтримується для цього ресурсу.");
}
