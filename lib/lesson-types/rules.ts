export function validateLessonTypeName(value: unknown): { ok: true; name: string } | { ok: false; message: string } {
  const name = typeof value === "string" ? value.normalize("NFC").trim().replace(/\s+/gu, " ") : "";
  if (name.length < 2 || name.length > 100 || /[\p{Cc}\p{Cf}]/u.test(name)) {
    return { ok: false, message: "Назва типу заняття має містити від 2 до 100 символів без службових знаків." };
  }
  return { ok: true, name };
}
