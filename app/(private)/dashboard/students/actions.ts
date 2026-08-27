"use server";

import { revalidatePath } from "next/cache";

import { requireTeacher } from "@/lib/auth/session";
import {
  addStudentToTeacherSubject,
  removeStudentFromTeacherSubject,
} from "@/lib/students/repository";

export type StudentActionState = Readonly<{
  success: boolean;
  message: string;
}>;

export const initialStudentActionState: StudentActionState = {
  success: false,
  message: "",
};

export async function addStudentAction(
  _previousState: StudentActionState,
  formData: FormData,
): Promise<StudentActionState> {
  const teacher = await requireTeacher();
  const result = await addStudentToTeacherSubject({
    teacherUserId: teacher.id,
    fullName: formData.get("fullName"),
    groupName: formData.get("groupName"),
    subjectId: formData.get("subjectId"),
  });

  if (result.success) revalidatePath("/dashboard/students");
  return result;
}

export async function removeStudentAction(enrollmentId: string): Promise<void> {
  const teacher = await requireTeacher();
  await removeStudentFromTeacherSubject(teacher.id, enrollmentId);
  revalidatePath("/dashboard/students");
}
