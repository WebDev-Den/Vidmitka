export type AuthFieldErrors = Readonly<{
  email?: string;
  password?: string;
}>;

export type LoginInput = Readonly<{
  email: string;
  password: string;
}>;

export type ValidationResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; message: string; fieldErrors: AuthFieldErrors }>;

export const PASSWORD_MAX_LENGTH = 128;

function stringValue(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value) && value.length <= 320;
}

export function validateLoginForm(
  formData: FormData,
): ValidationResult<LoginInput> {
  const email = normalizeEmail(stringValue(formData.get("email")));
  const password = stringValue(formData.get("password"));
  const fieldErrors: Record<string, string> = {};

  if (!isEmail(email)) {
    fieldErrors.email = "Вкажіть коректну адресу електронної пошти.";
  }
  if (!password || password.length > 128) {
    fieldErrors.password = "Введіть пароль.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      message: "Перевірте заповнення форми.",
      fieldErrors,
    };
  }

  return { ok: true, value: { email, password } };
}
