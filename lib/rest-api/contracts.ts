export const catalogResources = ["groups", "teachers", "disciplines", "rooms", "lesson-types"] as const;
export type CatalogResource = typeof catalogResources[number];
export const collectionResources = [...catalogResources, "entries", "exceptions", "periods", "calendar-overrides"] as const;
export type CollectionResource = typeof collectionResources[number];

export type Field = Readonly<{
  type: "string" | "integer" | "boolean" | "array";
  format?: "uuid" | "date";
  pattern?: string;
  enum?: readonly string[];
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  nullable?: boolean;
  minItems?: number;
  maxItems?: number;
  items?: Field;
}>;
export type ObjectContract = Readonly<{ properties: Readonly<Record<string, Field>>; required: readonly string[] }>;
const uuid: Field = { type: "string", format: "uuid" };
const date: Field = { type: "string", format: "date" };
const nullableDate: Field = { ...date, nullable: true };
const periodId: Field = { type: "string", pattern: "^[1-9][0-9]{0,14}$" };
const color: Field = { type: "string", pattern: "^#[0-9a-fA-F]{6}$" };
const time: Field = { type: "string", pattern: "^([01][0-9]|2[0-3]):[0-5][0-9]$" };
const ids: Field = { type: "array", items: uuid, maxItems: 250 };
const note: Field = { type: "string", maxLength: 500 };

export const activationContract: ObjectContract = { properties: { isActive: { type: "boolean" } }, required: ["isActive"] };
export const weekContract: ObjectContract = {
  properties: { anchorDate: date, anchorWeekType: { type: "string", enum: ["numerator", "denominator"] }, semesterStart: nullableDate, semesterEnd: nullableDate },
  required: ["anchorDate", "anchorWeekType"],
};
export const calendarContract: ObjectContract = {
  properties: { dayOfWeek: { type: "integer", minimum: 1, maximum: 7 }, weekType: { type: "string", enum: ["numerator", "denominator"] }, version: { type: "integer", minimum: 0 } },
  required: ["dayOfWeek", "weekType", "version"],
};
export const entryContract: ObjectContract = {
  properties: {
    disciplineId: uuid, lessonTypeId: uuid, periodId,
    dayOfWeek: { type: "integer", minimum: 1, maximum: 7 }, weekPattern: { type: "string", enum: ["numerator", "denominator", "both"] },
    validFrom: nullableDate, validUntil: nullableDate, note,
    groupIds: { ...ids, minItems: 1 }, teacherIds: { ...ids, minItems: 1 }, roomIds: ids,
  },
  required: ["disciplineId", "lessonTypeId", "periodId", "dayOfWeek", "weekPattern", "groupIds", "teacherIds"],
};
export const exceptionContract: ObjectContract = {
  properties: {
    kind: { type: "string", enum: ["move", "reschedule", "room_change", "teacher_change", "discipline_change", "type_change", "cancel", "one_time"] },
    baseEntryId: { ...uuid, nullable: true }, originalDate: date, newDate: nullableDate,
    periodId: { ...periodId, nullable: true }, customStartTime: { ...time, nullable: true }, customEndTime: { ...time, nullable: true },
    disciplineId: { ...uuid, nullable: true }, lessonTypeId: { ...uuid, nullable: true }, reason: note, note,
    status: { type: "string", enum: ["active", "superseded", "cancelled"] },
    groupIds: ids, teacherIds: ids, roomIds: ids,
  }, required: ["kind", "originalDate"],
};
export const periodContract: ObjectContract = {
  properties: { number: { type: "integer", minimum: 1, maximum: 99 }, startTime: time, endTime: time, color },
  required: ["number", "startTime", "endTime", "color"],
};
export function catalogContract(resource: CatalogResource): ObjectContract {
  const maxLength = resource === "groups" ? 100 : resource === "rooms" ? 120 : resource === "disciplines" ? 300 : 200;
  return {
    properties: { name: { type: "string", minLength: resource === "groups" || resource === "rooms" ? 1 : 2, maxLength }, ...(resource === "lesson-types" ? { color } : {}) },
    required: resource === "lesson-types" ? ["name", "color"] : ["name"],
  };
}
export function isCatalog(resource: string): resource is CatalogResource {
  return (catalogResources as readonly string[]).includes(resource);
}
export function isCollection(resource: string): resource is CollectionResource {
  return (collectionResources as readonly string[]).includes(resource);
}
export function collectionContract(resource: CollectionResource): ObjectContract {
  if (isCatalog(resource)) return catalogContract(resource);
  if (resource === "entries") return entryContract;
  if (resource === "exceptions") return exceptionContract;
  return resource === "periods" ? periodContract : calendarContract;
}
