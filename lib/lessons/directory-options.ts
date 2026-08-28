export type DirectoryOption = Readonly<{ id: string; name: string }>;
export type LessonDirectoryKind = "subject" | "room" | "lessonType";
export type DirectoryCreateResult =
  | Readonly<{ success: true; message: string; option: DirectoryOption }>
  | Readonly<{ success: false; message: string }>;

export const LESSON_DIRECTORIES = {
  subject: { name: "subjectId", label: "Навчальний предмет", placeholder: "Оберіть предмет", minLength: 2, maxLength: 200 },
  room: { name: "roomId", label: "Аудиторія", placeholder: "Оберіть аудиторію", minLength: 1, maxLength: 100 },
  lessonType: { name: "lessonTypeId", label: "Тип заняття", placeholder: "Оберіть тип заняття", minLength: 2, maxLength: 100 },
} as const;

export function isLessonDirectoryKind(value: unknown): value is LessonDirectoryKind {
  return value === "subject" || value === "room" || value === "lessonType";
}

export function normalizeDirectoryQuery(value: string): string {
  return value.normalize("NFC").trim().replace(/\s+/gu, " ");
}

function searchKey(value: string): string {
  return normalizeDirectoryQuery(value).toLocaleLowerCase("uk");
}

export function matchesDirectoryQuery(option: DirectoryOption, query: string): boolean {
  return searchKey(option.name).includes(searchKey(query));
}

export function canOfferDirectoryCreation(kind: LessonDirectoryKind, query: string, options: readonly DirectoryOption[]): boolean {
  const name = normalizeDirectoryQuery(query);
  const { minLength, maxLength } = LESSON_DIRECTORIES[kind];
  return name.length >= minLength && name.length <= maxLength && !/[\p{Cc}\p{Cf}]/u.test(name)
    && !options.some((option) => searchKey(option.name) === searchKey(name));
}

export function mergeDirectoryOptions(existing: readonly DirectoryOption[], created: readonly DirectoryOption[]): DirectoryOption[] {
  // Server props win when a revalidation has already returned the new record.
  return [...new Map([...created, ...existing].map((option) => [option.id, option])).values()]
    .sort((a, b) => a.name.localeCompare(b.name, "uk"));
}
