"use server";

import { revalidatePath } from "next/cache";

import { requireTeacher } from "@/lib/auth/session";
import {
  addStudentToTeacherSubject,
  removeStudentFromTeacherSubject,
} from "@/lib/students/repository";

import type { StudentActionState } from "./form-state";

export async function addStudentAction(
  _previousState: StudentActionState,
  formData: FormData,
): Promise<StudentActionState> {
  const teacher = await requireTeacher();
  const result = await addStudentToTeacherSubject({
    teacherUserId: teacher.id,
    fullName: formData.get("fullName"),
    groupMode: formData.get("groupMode"),
    existingGroupName: formData.get("existingGroupName"),
    newGroupName: formData.get("newGroupName"),
    subjectId: formData.get("subjectId"),
    subgroup: formData.get("subgroup"),
  });

  if (result.success) revalidatePath("/dashboard/students");
  if (result.success) revalidatePath("/dashboard/journal");
  if (result.success) revalidatePath("/dashboard/lessons/new");
  return result;
}

export async function removeStudentAction(enrollmentId: string): Promise<void> {
  const teacher = await requireTeacher();
  await removeStudentFromTeacherSubject(teacher.id, enrollmentId);
  revalidatePath("/dashboard/students");
  revalidatePath("/dashboard/journal");
}
