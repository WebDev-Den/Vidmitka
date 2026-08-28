"use client";

import { useActionState } from "react";
import { LessonStudentPicker } from "@/components/private/lesson-student-picker";
import type { GroupStudent, StudentGroup } from "@/lib/groups/repository";
import { initialLessonState } from "../../../lessons/new/form-state";
import { addLessonStudentsAction } from "./actions";

export function LessonStudentsForm({ lessonId, groups, students, existingStudentIds }: {
  lessonId: string; groups: StudentGroup[]; students: GroupStudent[]; existingStudentIds: string[];
}) {
  const [state, action, pending] = useActionState(addLessonStudentsAction, initialLessonState);
  return <form action={action} className="lesson-editor compact-form">
    <input type="hidden" name="lessonId" value={lessonId} />
    <LessonStudentPicker groups={groups} students={students} existingStudentIds={existingStudentIds} disabled={pending} />
    <button type="submit" className="button button-primary" disabled={pending}>{pending ? "Додавання…" : "Додати вибраних студентів"}</button>
    {state.message && <p className={`period-action-message ${state.success ? "is-success" : "is-error"}`} role={state.success ? "status" : "alert"}>{state.message}</p>}
  </form>;
}
