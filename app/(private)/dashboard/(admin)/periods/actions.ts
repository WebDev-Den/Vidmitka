"use server";

import { revalidatePath } from "next/cache";

import { requireAdministrator } from "@/lib/auth/session";
import {
  createClassPeriod,
  setClassPeriodActive,
  updateClassPeriod,
} from "@/lib/class-periods/repository";

export type PeriodActionState = Readonly<{
  success: boolean;
  message: string;
  submittedAt: number;
}>;

export const initialPeriodActionState: PeriodActionState = {
  success: false,
  message: "",
  submittedAt: 0,
};

function stateFromResult(result: {
  success: boolean;
  message: string;
}): PeriodActionState {
  return { ...result, submittedAt: Date.now() };
}

export async function createClassPeriodAction(
  _previousState: PeriodActionState,
  formData: FormData,
): Promise<PeriodActionState> {
  await requireAdministrator();

  const result = await createClassPeriod({
    number: formData.get("number"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
  });

  if (result.success) {
    revalidatePath("/dashboard/periods");
    revalidatePath("/dashboard/lessons/new");
  }
  return stateFromResult(result);
}

export async function updateClassPeriodAction(
  id: string,
  _previousState: PeriodActionState,
  formData: FormData,
): Promise<PeriodActionState> {
  await requireAdministrator();

  const intent = formData.get("intent");
  const result =
    intent === "activate" || intent === "deactivate"
      ? await setClassPeriodActive(id, intent === "activate")
      : await updateClassPeriod(id, {
          number: formData.get("number"),
          startTime: formData.get("startTime"),
          endTime: formData.get("endTime"),
        });

  if (result.success) {
    revalidatePath("/dashboard/periods");
    revalidatePath("/dashboard/lessons/new");
  }

  return stateFromResult(result);
}
