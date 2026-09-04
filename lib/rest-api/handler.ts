import "server-only";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getScheduleWeekConfiguration, saveScheduleWeekConfiguration } from "@/lib/schedule-week/repository";
import { getPublicScheduleDay } from "@/lib/schedule-v2/public-schedule";
import { requireApiAdministrator } from "./auth";
import { handleCollection, acceptMutation, type ApiResult } from "./collections";
import { handleImport } from "./import";
import { isCollection, weekContract } from "./contracts";
import { ApiError, queryParams, readJson, toFormData, validDate, validUuid, validateObject } from "./http";

export type ApiDependencies = Readonly<{
  authorize: typeof requireApiAdministrator;
  collection: typeof handleCollection;
  import: typeof handleImport;
  getWeeks: typeof getScheduleWeekConfiguration;
  saveWeeks: typeof saveScheduleWeekConfiguration;
  schedule: typeof getPublicScheduleDay;
  invalidate: () => void;
}>;
const dependencies: ApiDependencies = {
  authorize: requireApiAdministrator, collection: handleCollection, import: handleImport,
  getWeeks: getScheduleWeekConfiguration, saveWeeks: saveScheduleWeekConfiguration, schedule: getPublicScheduleDay,
  invalidate() {
    for (const path of ["/", "/schedule", "/transfers", "/admin"]) revalidatePath(path, "layout");
  },
};

async function dispatch(request: Request, segments: string[], administratorId: string, deps: ApiDependencies): Promise<ApiResult> {
  const [resource, id] = segments;
  if (segments.length > 2) throw new ApiError(404, "NOT_FOUND", "Маршрут не знайдено.");
  if (isCollection(resource)) return deps.collection(request, resource, id, administratorId);
  if (resource === "imports") return deps.import(request, id, administratorId);
  if (resource === "week-settings" && !id) {
    queryParams(new URL(request.url), []);
    if (request.method === "GET") return { data: await deps.getWeeks() };
    if (request.method === "PUT") {
      const form = toFormData(validateObject(await readJson(request), weekContract));
      const result = await deps.saveWeeks({ anchorDate: form.get("anchorDate"), anchorWeekType: form.get("anchorWeekType"), semesterStart: form.get("semesterStart"), semesterEnd: form.get("semesterEnd") });
      acceptMutation(result);
      return { data: result };
    }
    throw new ApiError(405, "METHOD_NOT_ALLOWED", "Використовуйте GET або PUT для налаштувань тижнів.");
  }
  if (resource === "schedule" && !id) {
    if (request.method !== "GET") throw new ApiError(405, "METHOD_NOT_ALLOWED", "Фактичний розклад доступний через GET. Зміни вносьте через entries та exceptions.");
    const query = queryParams(new URL(request.url), ["date", "teacherId", "groupId"]);
    const date = query.get("date") ?? "";
    if (!validDate(date)) throw new ApiError(400, "INVALID_QUERY", "Вкажіть date у форматі YYYY-MM-DD.");
    for (const name of ["teacherId", "groupId"]) if (query.has(name) && !validUuid(query.get(name)!)) throw new ApiError(400, "INVALID_QUERY", `Некоректний ${name}.`);
    return { data: await deps.schedule({ date, teacherId: query.get("teacherId") ?? undefined, groupId: query.get("groupId") ?? undefined }) };
  }
  throw new ApiError(404, "NOT_FOUND", "Маршрут не знайдено.");
}

/** Every data route authenticates before reading bodies, querying data or invoking mutations. */
export async function handleApiRequest(request: Request, segments: string[], deps: ApiDependencies = dependencies): Promise<Response> {
  const requestId = randomUUID();
  const headers = new Headers({ "Cache-Control": "no-store", "X-Request-Id": requestId, "X-Content-Type-Options": "nosniff" });
  try {
    const administratorId = await deps.authorize(request);
    const result = await dispatch(request, segments, administratorId, deps);
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method) && !(segments[0] === "imports" && segments[1] === "preview")) deps.invalidate();
    if (result.location) headers.set("Location", result.location);
    return Response.json({ data: result.data, requestId }, { status: result.status ?? 200, headers });
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    const failure = error instanceof ApiError ? error
      : ["23001", "23505", "23503", "23P01", "40001", "40P01"].includes(code) ? new ApiError(409, "CONFLICT", "Операція конфліктує з поточними або пов’язаними даними. Оновіть дані й повторіть запит.")
      : new ApiError(500, "INTERNAL_ERROR", "Не вдалося виконати запит.");
    if (failure.status === 401) headers.set("WWW-Authenticate", "Bearer");
    if (failure.status >= 500) console.error("schedule_rest_api_failed", { requestId, code: failure.code });
    return Response.json({ error: { code: failure.code, message: failure.message, ...(failure.details === undefined ? {} : { details: failure.details }) }, requestId }, { status: failure.status, headers });
  }
}
