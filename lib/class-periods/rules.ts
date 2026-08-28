import { parsePeriodColor, type PeriodColor } from "./colors";

export type ClassPeriodInput = Readonly<{
  number: FormDataEntryValue | null;
  startTime: FormDataEntryValue | null;
  endTime: FormDataEntryValue | null;
  color: FormDataEntryValue | null;
}>;

export type ComparableClassPeriod = Readonly<{
  id: string;
  number: number;
  startMinute: number;
  endMinute: number;
  isActive: boolean;
}>;

export type ClassPeriodDraft = Readonly<{
  number: number;
  startMinute: number;
  endMinute: number;
  color: PeriodColor;
}>;

export type ClassPeriodValidation =
  | Readonly<{ ok: true; value: ClassPeriodDraft }>
  | Readonly<{ ok: false; message: string }>;

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/u;

export function formatMinute(minute: number): string {
  const hours = Math.floor(minute / 60);
  const minutes = minute % 60;

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}`;
}

function parseTime(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || !TIME_PATTERN.test(value)) return null;

  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function validateClassPeriod(
  input: ClassPeriodInput,
  existingPeriods: readonly ComparableClassPeriod[],
  excludedId?: string,
): ClassPeriodValidation {
  const rawNumber = typeof input.number === "string" ? input.number.trim() : "";
  const number = Number(rawNumber);

  if (!Number.isInteger(number) || number < 1 || number > 99) {
    return {
      ok: false,
      message: "Номер пари має бути цілим числом від 1 до 99.",
    };
  }

  const startMinute = parseTime(input.startTime);
  const endMinute = parseTime(input.endTime);

  if (startMinute === null || endMinute === null) {
    return {
      ok: false,
      message: "Вкажіть коректний час початку та завершення.",
    };
  }

  if (startMinute >= endMinute) {
    return {
      ok: false,
      message: "Час завершення має бути пізніше за час початку.",
    };
  }

  const color = parsePeriodColor(input.color);
  if (!color) {
    return { ok: false, message: "Оберіть колір пари з палітри сайту." };
  }

  const comparable = existingPeriods.filter((period) => period.id !== excludedId);
  const duplicate = comparable.find((period) => period.number === number);

  if (duplicate) {
    return {
      ok: false,
      message: `Пара з номером ${number} уже існує.`,
    };
  }

  const overlap = comparable.find(
    (period) =>
      period.isActive &&
      startMinute < period.endMinute &&
      endMinute > period.startMinute,
  );

  if (overlap) {
    return {
      ok: false,
      message: `Час перетинається з ${overlap.number} парою (${formatMinute(
        overlap.startMinute,
      )}–${formatMinute(overlap.endMinute)}).`,
    };
  }

  return {
    ok: true,
    value: { number, startMinute, endMinute, color },
  };
}
