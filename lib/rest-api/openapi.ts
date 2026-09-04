import { activationContract, collectionContract, collectionResources, isCatalog, weekContract, type Field, type ObjectContract } from "./contracts";

type Schema = Record<string, unknown>;
function fieldSchema(field: Field): Schema {
  const { nullable, items, ...schema } = field;
  return { ...schema, type: nullable ? [field.type, "null"] : field.type, ...(items ? { items: fieldSchema(items) } : {}) };
}
function bodySchema(contract: ObjectContract): Schema {
  return { type: "object", additionalProperties: false, required: contract.required, properties: Object.fromEntries(Object.entries(contract.properties).map(([name, field]) => [name, fieldSchema(field)])) };
}
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const body = (schema: Schema) => ({ required: true, content: { "application/json": { schema } } });
const parameter = (name: string, location: "path" | "query", schema: Schema, required = false) => ({ name, in: location, required, schema });
const response = (schema: Schema, description = "Успішно") => ({ description, content: { "application/json": { schema } } });
const envelope = (data: Schema) => ({ type: "object", required: ["data", "requestId"], properties: { data, requestId: { type: "string", format: "uuid" } } });
const errorResponses = Object.fromEntries([
  [400, "Невірний JSON, ID або query"], [401, "Відсутній або невірний ключ"], [403, "Адміністратор не має доступу"],
  [404, "Не знайдено"], [405, "Метод не підтримується"], [409, "Конфлікт даних або потрібне підтвердження імпорту"],
  [413, "Тіло завелике"], [415, "Потрібен application/json"], [422, "Поля або бізнес-правила відхилено"],
  [500, "Внутрішня помилка"], [503, "API не налаштовано"],
].map(([code, description]) => [String(code), response(ref("Error"), String(description))]));
const mutationResponses = { "200": response(envelope(ref("Mutation"))), ...errorResponses };
const commonListParams = [
  parameter("limit", "query", { type: "integer", minimum: 1, maximum: 200, default: 100 }),
  parameter("offset", "query", { type: "integer", minimum: 0, maximum: 1000000, default: 0 }),
  parameter("q", "query", { type: "string" }), parameter("active", "query", { type: "string", enum: ["true", "false"] }),
];
const paths: Record<string, unknown> = {};
const schemas: Record<string, Schema> = {
  Error: { type: "object", required: ["error", "requestId"], properties: { requestId: { type: "string", format: "uuid" }, error: { type: "object", required: ["code", "message"], properties: { code: { type: "string" }, message: { type: "string" }, details: {} } } } },
  Mutation: { type: "object", required: ["success", "message"], properties: { success: { const: true }, message: { type: "string" }, id: { type: "string", description: "UUID, числовий string для periods або YYYY-MM-DD для календаря" } } },
  Activation: bodySchema(activationContract),
  WeekSettings: bodySchema(weekContract),
  ImportRecord: {
    type: "object", required: ["teacher", "date", "dayOfWeek", "period", "weekType", "subject", "room", "groups", "lessonType", "substitution"],
    properties: {
      teacher: { type: "string", minLength: 1, maxLength: 200 }, date: { type: "string", format: "date" },
      dayOfWeek: { type: "integer", minimum: 1, maximum: 7 }, period: { type: "integer", minimum: 1, maximum: 99 },
      weekType: { type: "string", enum: ["numerator", "denominator"] }, subject: { type: "string", minLength: 1, maxLength: 300 },
      room: { type: "string", minLength: 1, maxLength: 120 }, groups: { type: "array", minItems: 1, items: { type: "string", maxLength: 100 } },
      lessonType: { type: "string", minLength: 1, maxLength: 100 }, substitution: { type: "object", required: ["dayOfWeek", "weekType"], properties: { dayOfWeek: { type: "integer", minimum: 1, maximum: 7 }, weekType: { type: "string", enum: ["numerator", "denominator"] } } },
    },
  },
  Import: { type: "object", additionalProperties: false, required: ["records"], properties: { records: { type: "array", minItems: 1, maxItems: 10000, items: ref("ImportRecord") }, confirmWarnings: { type: "boolean", default: false } } },
};

for (const resource of collectionResources) {
  schemas[resource] = bodySchema(collectionContract(resource));
  const isCalendar = resource === "calendar-overrides";
  const idParam = parameter("id", "path", resource === "periods" ? { type: "string", pattern: "^[1-9][0-9]{0,14}$" } : { type: "string", format: isCalendar ? "date" : "uuid" }, true);
  const listParams = resource === "entries" || resource === "exceptions"
    ? [...commonListParams, parameter("teacherId", "query", { type: "string", format: "uuid" }), parameter("groupId", "query", { type: "string", format: "uuid" })] : commonListParams;
  paths[`/${resource}`] = {
    get: { operationId: `list-${resource}`, tags: [resource], summary: `Перелік ${resource}`, parameters: listParams,
      responses: { "200": response(envelope({ type: "object", required: ["items", "total", "limit", "offset"], properties: { items: { type: "array", items: { type: "object" } }, total: { type: "integer" }, limit: { type: "integer" }, offset: { type: "integer" } } })), ...errorResponses } },
    ...(!isCalendar ? { post: { operationId: `create-${resource}`, tags: [resource], summary: `Створити ${resource}`, requestBody: body(ref(resource)), responses: { "201": { ...response(envelope(ref("Mutation"))), headers: { Location: { description: "URL створеного ресурсу", schema: { type: "string" } } } }, ...errorResponses } } } : {}),
  };
  paths[`/${resource}/{id}`] = {
    parameters: [idParam],
    get: { operationId: `get-${resource}`, tags: [resource], summary: "Прочитати один запис", responses: { "200": response(envelope({ type: "object" })), ...errorResponses } },
    put: { operationId: `replace-${resource}`, tags: [resource], summary: isCalendar ? "Створити або змінити календарну дату за version" : "Оновити всі редаговані поля", description: "Необов’язкові пропущені поля очищаються. isActive змінюється окремо через PATCH. Для calendar version=0 означає створення; актуальна version потрібна для зміни.", requestBody: body(ref(resource)), responses: mutationResponses },
    delete: { operationId: `delete-${resource}`, tags: [resource], summary: "Видалити запис із перевіркою зв’язків", ...(isCalendar ? { parameters: [parameter("version", "query", { type: "integer", minimum: 1 }, true)] } : {}), responses: mutationResponses },
    ...(isCatalog(resource) || resource === "entries" || resource === "periods" ? { patch: { operationId: `activate-${resource}`, tags: [resource], summary: "Активувати або деактивувати", requestBody: body(ref("Activation")), responses: mutationResponses } } : {}),
  };
  if (isCatalog(resource) || resource === "periods") {
    const contract = collectionContract(resource);
    const item = bodySchema({ properties: { ...contract.properties, id: resource === "periods" ? { type: "string", pattern: "^[1-9][0-9]{0,14}$" } : { type: "string", format: "uuid" } }, required: ["id", ...contract.required] });
    paths[`/${resource}/batch`] = {
      put: { operationId: `batch-update-${resource}`, tags: [resource], summary: "Атомарно оновити пакет записів",
        requestBody: body({ type: "object", additionalProperties: false, required: ["changes"], properties: { changes: { type: "array", minItems: 1, maxItems: resource === "periods" ? 99 : 25, items: item } } }), responses: mutationResponses },
    };
  }
}
paths["/week-settings"] = {
  get: { operationId: "get-week-settings", tags: ["week-settings"], responses: { "200": response(envelope({ anyOf: [ref("WeekSettings"), { type: "null" }] })), ...errorResponses } },
  put: { operationId: "save-week-settings", tags: ["week-settings"], requestBody: body(ref("WeekSettings")), responses: mutationResponses },
};
paths["/schedule"] = {
  get: { operationId: "get-resolved-schedule", tags: ["schedule"], summary: "Фактичний денний розклад із переносами та скасуваннями", parameters: [parameter("date", "query", { type: "string", format: "date" }, true), parameter("teacherId", "query", { type: "string", format: "uuid" }), parameter("groupId", "query", { type: "string", format: "uuid" })], responses: { "200": response(envelope({ type: "object" })), ...errorResponses } },
};
for (const operation of ["preview", "commit"]) paths[`/imports/${operation}`] = {
  post: { operationId: `import-${operation}`, tags: ["imports"], summary: operation === "preview" ? "Перевірити імпорт без запису" : "Атомарно застосувати імпорт", description: "До 4 MiB JSON. records використовує чинний teacher-schedule JSON формат; повторний ідентичний імпорт не дублює заняття. За наявності попереджень commit потребує confirmWarnings=true.", requestBody: body(ref("Import")), responses: { "200": response(envelope({ type: "object" })), ...errorResponses } },
};

/** Request schemas are shared with runtime validation to prevent contract drift. */
export const openApiDocument = {
  openapi: "3.1.0",
  info: { title: "Відмітка — API керування розкладом", version: "1.0.0", description: "Server-to-server API. Bearer key дає права одного схваленого адміністратора. До налаштування server env запити повертають 503. Звичайні JSON bodies до 64 KiB; imports до 4 MiB. PUT передає всі редаговані поля; PATCH підтримує лише isActive. CORS для браузерних інтеграцій не увімкнено." },
  servers: [{ url: "/api/v1" }],
  security: [{ bearerAuth: [] }],
  paths,
  components: { securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "API key" } }, schemas },
};
