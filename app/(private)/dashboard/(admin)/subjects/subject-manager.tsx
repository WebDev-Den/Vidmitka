"use client";

import { BookOpen, Check, PauseCircle, Plus } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";

import type { Subject } from "@/lib/subjects/repository";

import {
  createSubjectAction,
  toggleSubjectAction,
} from "./actions";
import { initialSubjectActionState } from "./form-state";

export function SubjectManager({ subjects }: { subjects: Subject[] }) {
  const [state, formAction, pending] = useActionState(
    createSubjectAction,
    initialSubjectActionState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success, state.message]);

  return (
    <div className="subject-manager">
      <form ref={formRef} action={formAction} className="subject-create-form">
        <label>
          Назва навчального предмета
          <input name="name" type="text" maxLength={200} required />
        </label>
        <button className="button button-primary" type="submit" disabled={pending}>
          <Plus size={17} />
          {pending ? "Додавання…" : "Додати предмет"}
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

      <div className="subject-list">
        {subjects.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state-icon"><BookOpen size={22} /></span>
            <h2>Предметів ще немає</h2>
            <p>Додайте предмет, щоб викладачі могли формувати списки студентів.</p>
          </div>
        ) : (
          subjects.map((subject) => {
            const toggleAction = toggleSubjectAction.bind(
              null,
              subject.id,
              !subject.isActive,
            );

            return (
              <div className="subject-row" key={subject.id}>
                <div>
                  <strong>{subject.name}</strong>
                  <span>{subject.isActive ? "Активний" : "Неактивний"}</span>
                </div>
                <form action={toggleAction}>
                  <button className="button button-light" type="submit">
                    {subject.isActive ? <PauseCircle size={16} /> : <Check size={16} />}
                    {subject.isActive ? "Деактивувати" : "Активувати"}
                  </button>
                </form>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
