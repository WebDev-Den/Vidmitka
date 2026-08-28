"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { GroupStudent, StudentGroup } from "@/lib/groups/repository";
import { LESSON_DAYS } from "@/lib/lessons/rules";
import { createLessonAction } from "./actions";
import { initialLessonState } from "./form-state";

type Choice = { id: string; name: string };
export function LessonForm({ subjects, rooms, periods, lessonTypes, groups, students, teachers, isAdministrator, currentUserId }: {
  subjects: Choice[]; rooms: Choice[]; periods: Choice[]; lessonTypes: Choice[]; groups: StudentGroup[]; students: GroupStudent[];
  teachers: Choice[]; isAdministrator: boolean; currentUserId: string;
}) {
  const [state, action, pending] = useActionState(createLessonAction, initialLessonState);
  const [groupNames, setGroupNames] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const ready = subjects.length > 0 && rooms.length > 0 && periods.length > 0 && lessonTypes.length > 0 && (!isAdministrator || teachers.length > 0);
  const visibleStudents = students.filter((student) => groupNames.includes(student.groupName));

  function toggleGroup(name: string, checked: boolean) {
    setGroupNames((current) => checked ? [...current, name] : current.filter((group) => group !== name));
    if (!checked) {
      const removed = new Set(students.filter((student) => student.groupName === name).map((student) => student.id));
      setSelected((current) => current.filter((id) => !removed.has(id)));
    }
  }
  return <form action={action} className="lesson-editor lesson-create-form">
    {!ready && <p className="notice journal-wide">Для створення заняття адміністратор має додати активні предмети, аудиторії, пари, типи занять та схвалити викладача.</p>}
    {isAdministrator && <label>Викладач
      <select name="teacherId" defaultValue={currentUserId} required disabled={pending}>
        <option value="" disabled>Оберіть викладача</option>
        {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}{teacher.id === currentUserId ? " (я)" : ""}</option>)}
      </select>
    </label>}
    <label>Навчальний предмет
      <select name="subjectId" defaultValue="" required disabled={pending}>
        <option value="" disabled>Оберіть предмет</option>
        {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
      </select>
    </label>
    <label>Аудиторія
      <select name="roomId" defaultValue="" required disabled={pending}>
        <option value="" disabled>Оберіть аудиторію</option>
        {rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
      </select>
    </label>
    <label>Тип заняття
      <select name="lessonTypeId" defaultValue="" required disabled={pending}>
        <option value="" disabled>Оберіть тип заняття</option>
        {lessonTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
      </select>
    </label>
    <label>День тижня
      <select name="dayOfWeek" defaultValue="1" disabled={pending}>
        {LESSON_DAYS.map((day, index) => <option key={day} value={index + 1}>{day}</option>)}
      </select>
    </label>
    <label>Номер пари
      <select name="classPeriodId" defaultValue="" required disabled={pending}>
        <option value="" disabled>Оберіть пару</option>
        {periods.map((period) => <option key={period.id} value={period.id}>{period.name}</option>)}
      </select>
    </label>
    <label>Тип навчального тижня
      <select name="weekType" defaultValue="both" disabled={pending}>
        <option value="both">Обидва тижні</option><option value="numerator">Чисельник</option><option value="denominator">Знаменник</option>
      </select>
    </label>
    <fieldset className="lesson-group-picker" disabled={pending}>
      <legend>Групи заняття</legend>
      <p>Оберіть групи, з яких додаватимете студентів.</p>
      {!groups.length && <p>Груп ще немає. Додайте студента з новою групою у розділі «Мої студенти».</p>}
      {groups.map((group) => <label key={group.name}>
        <input type="checkbox" name="groupNames" value={group.name} checked={groupNames.includes(group.name)}
          onChange={(event) => toggleGroup(group.name, event.target.checked)} />
        {group.name} · студентів: {group.studentCount}
      </label>)}
    </fieldset>
    <fieldset className="lesson-student-picker" disabled={pending}>
      <legend>Студенти цього заняття</legend>
      <p>Вибрано: {selected.length}. До журналу потраплять лише ці студенти, незалежно від інших занять предмета.</p>
      {groupNames.length === 0 && <p>Спочатку виберіть групу вище.</p>}
      {groupNames.map((name) => <div key={name} className="lesson-group-students">
        <h3>{name}</h3>
        <button type="button" className="button button-light" onClick={() => setSelected((current) => [...new Set([
          ...current, ...visibleStudents.filter((student) => student.groupName === name).map((student) => student.id),
        ])])}>Вибрати всіх із {name}</button>
        {!visibleStudents.some((student) => student.groupName === name) && <p>У цій групі немає активних студентів.</p>}
        {visibleStudents.filter((student) => student.groupName === name).map((student) => <label key={student.id}>
          <input type="checkbox" name="studentIds" value={student.id} checked={selected.includes(student.id)}
            onChange={(event) => setSelected((current) => event.target.checked ? [...current, student.id] : current.filter((id) => id !== student.id))} />
          {student.fullName}
        </label>)}
      </div>)}
      {selected.length > 0 && <button className="button button-light" type="button" onClick={() => setSelected([])}>Зняти вибір студентів</button>}
    </fieldset>
    <button className="button button-primary" type="submit" disabled={pending || !ready || !selected.length}>{pending ? "Створення…" : "Створити заняття"}</button>
    <Link className="button button-light" href="/dashboard/students">Додати студента або нову групу</Link>
    {state.message && <div className={`period-action-message ${state.success ? "is-success" : "is-error"}`} role={state.success ? "status" : "alert"}>
      <p>{state.message}</p>
      {state.success && <Link href="/dashboard/my-lessons">Переглянути мої заняття</Link>}
    </div>}
  </form>;
}
