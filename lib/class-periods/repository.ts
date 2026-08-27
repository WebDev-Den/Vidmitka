import "server-only";

import { getDb } from "@/lib/db";

import {
  formatMinute,
  validateClassPeriod,
  type ClassPeriodDraft,
  type ClassPeriodInput,
  type ComparableClassPeriod,
} from "./rules";

export type ClassPeriod = ComparableClassPeriod &
  Readonly<{
    startTime: string;
    endTime: string;
    label: string;
  }>;

export type ClassPeriodMutationResult = Readonly<{
  success: boolean;
  message: string;
}>;

type PeriodRow = {
  id: string | number;
  number: number;
  start_minute: number;
  end_minute: number;
  is_active: boolean;
};

function toClassPeriod(row: PeriodRow): ClassPeriod {
  const startTime = formatMinute(row.start_minute);
  const endTime = formatMinute(row.end_minute);

  return {
    id: String(row.id),
    number: row.number,
    startMinute: row.start_minute,
    endMinute: row.end_minute,
    startTime,
    endTime,
    isActive: row.is_active,
    label: `${row.number} пара · ${startTime}–${endTime}`,
  };
}

function mutationError(error: unknown): ClassPeriodMutationResult {
  const databaseError = error as { code?: string };

  if (databaseError.code === "23505") {
    return { success: false, message: "Пара з таким номером уже існує." };
  }

  if (databaseError.code === "23P01") {
    return {
      success: false,
      message: "Час цієї пари перетинається з іншою активною парою.",
    };
  }

  throw error;
}

async function getPeriodRows(): Promise<ClassPeriod[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT id, number, start_minute, end_minute, is_active
    FROM class_periods
    ORDER BY number ASC
  `;

  return (rows as PeriodRow[]).map(toClassPeriod);
}

async function validateDraft(
  input: ClassPeriodInput,
  excludedId?: string,
): Promise<
  | Readonly<{ ok: true; value: ClassPeriodDraft }>
  | Readonly<{ ok: false; result: ClassPeriodMutationResult }>
> {
  const validation = validateClassPeriod(
    input,
    await getPeriodRows(),
    excludedId,
  );

  return validation.ok
    ? validation
    : {
        ok: false,
        result: { success: false, message: validation.message },
      };
}

export async function listClassPeriods(options?: {
  activeOnly?: boolean;
}): Promise<ClassPeriod[]> {
  const periods = await getPeriodRows();
  return options?.activeOnly
    ? periods.filter((period) => period.isActive)
    : periods;
}

export async function createClassPeriod(
  input: ClassPeriodInput,
): Promise<ClassPeriodMutationResult> {
  const validation = await validateDraft(input);
  if (!validation.ok) return validation.result;

  const sql = getDb();
  const { number, startMinute, endMinute } = validation.value;

  try {
    await sql`
      INSERT INTO class_periods (number, start_minute, end_minute)
      VALUES (${number}, ${startMinute}, ${endMinute})
    `;
  } catch (error) {
    return mutationError(error);
  }

  return { success: true, message: `${number} пару додано.` };
}

export async function updateClassPeriod(
  id: string,
  input: ClassPeriodInput,
): Promise<ClassPeriodMutationResult> {
  if (!/^\d+$/u.test(id)) {
    return { success: false, message: "Некоректний ідентифікатор пари." };
  }

  const validation = await validateDraft(input, id);
  if (!validation.ok) return validation.result;

  const sql = getDb();
  const { number, startMinute, endMinute } = validation.value;

  try {
    const rows = (await sql`
      UPDATE class_periods
      SET
        number = ${number},
        start_minute = ${startMinute},
        end_minute = ${endMinute},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING id
    `) as unknown as Array<{ id: string | number }>;

    if (rows.length === 0) {
      return { success: false, message: "Пару не знайдено." };
    }
  } catch (error) {
    return mutationError(error);
  }

  return { success: true, message: `${number} пару оновлено.` };
}

export async function setClassPeriodActive(
  id: string,
  isActive: boolean,
): Promise<ClassPeriodMutationResult> {
  if (!/^\d+$/u.test(id)) {
    return { success: false, message: "Некоректний ідентифікатор пари." };
  }

  const periods = await getPeriodRows();
  const period = periods.find((item) => item.id === id);

  if (!period) {
    return { success: false, message: "Пару не знайдено." };
  }

  if (isActive) {
    const validation = validateClassPeriod(
      {
        number: String(period.number),
        startTime: period.startTime,
        endTime: period.endTime,
      },
      periods,
      id,
    );

    if (!validation.ok) {
      return { success: false, message: validation.message };
    }
  }

  const sql = getDb();

  try {
    await sql`
      UPDATE class_periods
      SET is_active = ${isActive}, updated_at = NOW()
      WHERE id = ${id}
    `;
  } catch (error) {
    return mutationError(error);
  }

  return {
    success: true,
    message: isActive
      ? `${period.number} пару активовано.`
      : `${period.number} пару деактивовано.`,
  };
}
