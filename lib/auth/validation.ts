export type AuthFieldErrors = Readonly<{
  fullName?: string;
  email?: string;
  password?: string;
  passwordConfirmation?: string;
}>;

export type RegistrationInput = Readonly<{
  fullName: string;
  email: string;
  password: string;
  administratorCode: string;
}>;

export type LoginInput = Readonly<{
  email: string;
  password: string;
}>;

export type ValidationResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; message: string; fieldErrors: AuthFieldErrors }>;

function stringValue(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeFullName(value: string): string {
  return value.trim().replace(/\s+/gu, " ");
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value) && value.length <= 320;
}

export function validateRegistrationForm(
  formData: FormData,
): ValidationResult<RegistrationInput> {
  const fullName = normalizeFullName(stringValue(formData.get("fullName")));
  const email = normalizeEmail(stringValue(formData.get("email")));
  const password = stringValue(formData.get("password"));
  const passwordConfirmation = stringValue(
    formData.get("passwordConfirmation"),
  );
  const administratorCode = stringValue(formData.get("administratorCode")).trim();
  const fieldErrors: Record<string, string> = {};

  if (fullName.length < 3 || fullName.length > 200) {
    fieldErrors.fullName = "Вкажіть ПІБ довжиною від 3 до 200 символів.";
  }
  if (!isEmail(email)) {
    fieldErrors.email = "Вкажіть коректну адресу електронної пошти.";
  }
  if (password.length < 15 || password.length > 128) {
    fieldErrors.password = "Пароль має містити від 15 до 128 символів.";
  }
  if (password !== passwordConfirmation) {
    fieldErrors.passwordConfirmation = "Паролі не збігаються.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      message: "Перевірте заповнення форми.",
      fieldErrors,
    };
  }

  return { ok: true, value: { fullName, email, password, administratorCode } };
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
