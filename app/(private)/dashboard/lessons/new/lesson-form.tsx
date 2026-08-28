"use client";

import Link from "next/link";
import { useActionState } from "react";
import { LessonStudentPicker } from "@/components/private/lesson-student-picker";
import { DirectoryCombobox } from "@/components/private/directory-combobox";
import type { GroupStudent, StudentGroup } from "@/lib/groups/repository";
import { LESSON_DAYS } from "@/lib/lessons/rules";
import type { LessonFormDefaults } from "@/lib/lessons/copy-draft";
import { createLessonAction } from "./actions";
import { initialLessonState } from "./form-state";
import { useLessonDirectories } from "./use-lesson-directories";

type Choice = { id: string; name: string };
export function LessonForm({ subjects, rooms, periods, lessonTypes, groups, students, teachers, isAdministrator, currentUserId, defaults }: {
  subjects: Choice[]; rooms: Choice[]; periods: Choice[]; lessonTypes: Choice[]; groups: StudentGroup[]; students: GroupStudent[];
  teachers: Choice[]; isAdministrator: boolean; currentUserId: string;
  defaults?: LessonFormDefaults;
}) {
  const [state, action, pending] = useActionState(createLessonAction, initialLessonState);
  const directories = useLessonDirectories({ subject: subjects, room: rooms, lessonType: lessonTypes }, defaults ? {
    subject: defaults.subjectId, room: defaults.roomId, lessonType: defaults.lessonTypeId,
  } : undefined);
  const ready = directories.options.subject.length > 0 && directories.options.room.length > 0 && periods.length > 0
    && directories.options.lessonType.length > 0 && (!isAdministrator || teachers.length > 0);
  // Server validation may resolve with an error; retain the complete editable draft.
  return <form action={action} className="lesson-editor lesson-create-form compact-form"
    onReset={(event) => event.preventDefault()}
    onSubmit={(event) => { if (directories.isCreating) event.preventDefault(); }}>
    {!ready && <p className="notice journal-wide">Для створення заняття адміністратор має додати активні предмети, аудиторії, пари, типи занять та схвалити викладача.</p>}
    {isAdministrator && <label>Викладач
      <select name="teacherId" defaultValue={defaults?.teacherId ?? currentUserId} required disabled={pending}>
        <option value="" disabled>Оберіть викладача</option>
        {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}{teacher.id === currentUserId ? " (я)" : ""}</option>)}
      </select>
    </label>}
    {(["subject", "room", "lessonType"] as const).map((kind) => <DirectoryCombobox key={kind}
      kind={kind} options={directories.options[kind]} value={directories.values[kind]}
      onValueChange={(id) => directories.select(kind, id)}
      onCreate={isAdministrator ? (name) => directories.create(kind, name) : undefined}
      disabled={pending} busy={directories.isCreating} creating={directories.creatingKind === kind}
      result={directories.results[kind]} />)}
    <label>День тижня
      <select name="dayOfWeek" defaultValue={defaults?.dayOfWeek ?? 1} disabled={pending}>
        {LESSON_DAYS.map((day, index) => <option key={day} value={index + 1}>{day}</option>)}
      </select>
    </label>
    <label>Номер пари
      <select name="classPeriodId" defaultValue={defaults?.classPeriodId ?? ""} required disabled={pending}>
        <option value="" disabled>Оберіть пару</option>
        {periods.map((period) => <option key={period.id} value={period.id}>{period.name}</option>)}
      </select>
    </label>
    <label>Тип навчального тижня
      <select name="weekType" defaultValue={defaults?.weekType ?? "both"} disabled={pending}>
        <option value="both">Обидва тижні</option><option value="numerator">Чисельник</option><option value="denominator">Знаменник</option>
      </select>
    </label>
    <LessonStudentPicker groups={groups} students={students} disabled={pending} optional initialStudentIds={defaults?.studentIds} />
    <button className="button button-primary" type="submit" disabled={pending || directories.isCreating || !ready}>{pending ? "Створення…" : defaults ? "Створити копію" : "Створити заняття"}</button>
    <Link className="button button-light" href={defaults ? "/dashboard/my-lessons" : "/dashboard/students"}>{defaults ? "Скасувати" : "Додати студента або нову групу"}</Link>
    {state.message && <div className={`period-action-message ${state.success ? "is-success" : "is-error"}`} role={state.success ? "status" : "alert"}>
      <p>{state.message}</p>
      {state.success && <Link href="/dashboard/my-lessons">Переглянути мої заняття</Link>}
    </div>}
  </form>;
}
