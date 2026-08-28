"use server";

import { revalidatePath } from "next/cache";

import { requireAdministrator } from "@/lib/auth/session";
import {
  createClassPeriod,
  setClassPeriodActive,
  updateClassPeriod,
} from "@/lib/class-periods/repository";

import type { PeriodActionState } from "./form-state";

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
    color: formData.get("color"),
  });

  if (result.success) {
    revalidatePath("/");
    revalidatePath("/schedule");
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
          color: formData.get("color"),
        });

  if (result.success) {
    revalidatePath("/");
    revalidatePath("/schedule");
    revalidatePath("/dashboard/schedule");
    revalidatePath("/dashboard/journal");
    revalidatePath("/dashboard/my-lessons");
    revalidatePath("/dashboard/periods");
    revalidatePath("/dashboard/lessons/new");
  }

  return stateFromResult(result);
}
