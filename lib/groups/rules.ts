export function validateGroupSelection(input: { mode: unknown; existingName: unknown; newName: unknown }):
  { ok: true; name: string; mustExist: boolean } | { ok: false; message: string } {
  if (input.mode !== "existing" && input.mode !== "new") return { ok: false, message: "Оберіть наявну або нову групу." };
  const raw = input.mode === "existing" ? input.existingName : input.newName;
  const name = typeof raw === "string" ? raw.trim().replace(/\s+/gu, " ") : "";
  if (name.length < 2 || name.length > 100) return { ok: false, message: "Оберіть групу або введіть назву нової (2–100 символів)." };
  return { ok: true, name, mustExist: input.mode === "existing" };
}
