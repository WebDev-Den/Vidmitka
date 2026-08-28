"use server";

import { revalidatePath } from "next/cache";

import { requireAdministrator } from "@/lib/auth/session";
import { createSubject, setSubjectActive } from "@/lib/subjects/repository";

import type { SubjectActionState } from "./form-state";

export async function createSubjectAction(
  _previousState: SubjectActionState,
  formData: FormData,
): Promise<SubjectActionState> {
  await requireAdministrator();
  const result = await createSubject(formData.get("name"));

  if (result.success) {
    revalidatePath("/dashboard/subjects");
    revalidatePath("/dashboard/students");
    revalidatePath("/dashboard/lessons/new");
  }

  return result;
}

export async function toggleSubjectAction(
  id: string,
  isActive: boolean,
): Promise<void> {
  await requireAdministrator();
  await setSubjectActive(id, isActive);
  revalidatePath("/dashboard/subjects");
  revalidatePath("/dashboard/students");
  revalidatePath("/dashboard/lessons/new");
}
