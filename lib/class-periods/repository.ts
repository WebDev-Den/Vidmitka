import "server-only";

import { getDb } from "@/lib/db";

import type { PeriodColor } from "./colors";

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
    color: PeriodColor;
  }>;

export type ClassPeriodMutationResult = Readonly<{
  success: boolean;
  message: string;
  id?: string;
}>;

export type ClassPeriodBatchInput = Readonly<{
  id: string;
  number: string;
  startTime: string;
  endTime: string;
  color: string;
}>;

type PeriodRow = {
  id: string | number;
  number: number;
  start_minute: number;
  end_minute: number;
  is_active: boolean;
  color: PeriodColor;
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
    color: row.color,
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
    SELECT id, number, start_minute, end_minute, is_active, color
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
  const { number, startMinute, endMinute, color } = validation.value;

  try {
    const [row] = await sql`
      INSERT INTO class_periods (number, start_minute, end_minute, color)
      VALUES (${number}, ${startMinute}, ${endMinute}, ${color})
      RETURNING id::TEXT
    `;
    return { success: true, message: `${number} пару додано.`, id: String(row.id) };
  } catch (error) {
    return mutationError(error);
  }

}

/** Foreign keys preserve schedule/history references; deleting a used period is rejected. */
export async function deleteClassPeriod(id: string): Promise<ClassPeriodMutationResult> {
  if (!/^\d+$/u.test(id)) return { success: false, message: "Некоректний ідентифікатор пари." };
  const sql = getDb();
  const rows = await sql`DELETE FROM class_periods WHERE id=${id} RETURNING id`;
  return rows.length ? { success: true, message: "Пару видалено." } : { success: false, message: "Пару не знайдено." };
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
  const { number, startMinute, endMinute, color } = validation.value;

  try {
    const rows = (await sql`
      UPDATE class_periods
      SET
        number = ${number},
        start_minute = ${startMinute},
        end_minute = ${endMinute},
        color = ${color},
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

export async function updateClassPeriods(
  changes: readonly ClassPeriodBatchInput[],
): Promise<ClassPeriodMutationResult> {
  if (!changes.length) return { success: false, message: "Немає змінених пар для збереження." };
  if (changes.length > 99) return { success: false, message: "За один раз можна зберегти до 99 пар." };

  const existing = await getPeriodRows();
  const existingById = new Map(existing.map((period) => [period.id, period]));
  const seen = new Set<string>();
  const drafts: Array<Readonly<{ id: string; input: ClassPeriodInput; value: ClassPeriodDraft }>> = [];
  for (const change of changes) {
    if (!/^\d+$/u.test(change.id) || seen.has(change.id) || !existingById.has(change.id)) {
      return { success: false, message: "Одна зі змінених пар більше не існує. Оновіть сторінку." };
    }
    seen.add(change.id);
    const input: ClassPeriodInput = {
      number: change.number,
      startTime: change.startTime,
      endTime: change.endTime,
      color: change.color,
    };
    const parsed = validateClassPeriod(input, [], change.id);
    if (!parsed.ok) return { success: false, message: parsed.message };
    drafts.push({ id: change.id, input, value: parsed.value });
  }

  const draftById = new Map(drafts.map((draft) => [draft.id, draft.value]));
  const proposedPeriods = existing.map((period) => {
    const draft = draftById.get(period.id);
    return draft
      ? { ...period, number: draft.number, startMinute: draft.startMinute, endMinute: draft.endMinute }
      : period;
  });
  for (const draft of drafts) {
    const validation = validateClassPeriod(draft.input, proposedPeriods, draft.id);
    if (!validation.ok) return { success: false, message: validation.message };
  }

  const sql = getDb();
  try {
    await sql.transaction(drafts.map((draft) => sql`
      UPDATE class_periods
      SET number=${draft.value.number}, start_minute=${draft.value.startMinute}, end_minute=${draft.value.endMinute},
        color=${draft.value.color}, updated_at=NOW()
      WHERE id=${draft.id}
    `));
  } catch (error) {
    return mutationError(error);
  }

  return { success: true, message: `Оновлено пар: ${drafts.length}.` };
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
        color: period.color,
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
