"use client";

import { GraduationCap, Plus, UserMinus } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";

import type { Subject } from "@/lib/subjects/repository";
import type { TeacherStudent } from "@/lib/students/repository";

import {
  addStudentAction,
  initialStudentActionState,
  removeStudentAction,
} from "./actions";

export function StudentManager({
  subjects,
  students,
}: {
  subjects: Subject[];
  students: TeacherStudent[];
}) {
  const [state, formAction, pending] = useActionState(
    addStudentAction,
    initialStudentActionState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success, state.message]);

  return (
    <div className="student-manager">
      <form ref={formRef} action={formAction} className="lesson-editor">
        <div className="settings-form-heading">
          <h2>Додати студента до предмета</h2>
          <p>Студент буде доступний лише у ваших списках вибраного предмета.</p>
        </div>
        <label>
          ПІБ студента
          <input name="fullName" type="text" maxLength={200} required />
        </label>
        <label>
          Навчальна група
          <input name="groupName" type="text" maxLength={100} required />
        </label>
        <label>
          Навчальний предмет
          <select name="subjectId" defaultValue="" required disabled={subjects.length === 0}>
            <option value="" disabled>Оберіть предмет</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>{subject.name}</option>
            ))}
          </select>
        </label>
        <button
          className="button button-primary"
          type="submit"
          disabled={pending || subjects.length === 0}
        >
          <Plus size={17} />
          {pending ? "Додавання…" : "Додати студента"}
        </button>
        {state.message ? (
          <p
            className={`period-action-message${state.success ? " is-success" : " is-error"}`}
            role={state.success ? "status" : "alert"}
          >
            {state.message}
          </p>
        ) : null}
      </form>

      <section className="student-list-section" aria-labelledby="student-list-title">
        <div className="period-list-heading">
          <div>
            <span className="eyebrow">МОЇ СПИСКИ</span>
            <h2 id="student-list-title">Студенти за предметами</h2>
          </div>
          <span>{students.length} зв’язків</span>
        </div>

        {students.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state-icon"><GraduationCap size={22} /></span>
            <h2>Студентів ще не додано</h2>
            <p>Оберіть предмет і створіть перший запис студента.</p>
          </div>
        ) : (
          <div className="student-list">
            {students.map((student) => {
              const removeAction = removeStudentAction.bind(
                null,
                student.enrollmentId,
              );

              return (
                <article className="student-row" key={student.enrollmentId}>
                  <span className="student-avatar" aria-hidden="true">
                    {student.fullName
                      .split(" ")
                      .slice(0, 2)
                      .map((part) => part[0])
                      .join("")}
                  </span>
                  <div className="student-identity">
                    <strong>{student.fullName}</strong>
                    <span>{student.groupName}</span>
                  </div>
                  <span className="student-subject">{student.subjectName}</span>
                  <form action={removeAction}>
                    <button className="button button-light" type="submit">
                      <UserMinus size={16} />
                      Прибрати з предмета
                    </button>
                  </form>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
