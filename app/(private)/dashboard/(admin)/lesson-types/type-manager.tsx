"use client";

import { useActionState } from "react";
import type { LessonType } from "@/lib/lesson-types/repository";
import { saveLessonTypeAction, toggleLessonTypeAction } from "./actions";
import { initialLessonTypeState, type LessonTypeActionState } from "./form-state";

function Message({ state }: { state: LessonTypeActionState }) {
  return state.message ? <p className={`period-action-message ${state.success ? "is-success" : "is-error"}`}
    role={state.success ? "status" : "alert"}>{state.message}</p> : null;
}

function TypeRow({ type }: { type: LessonType }) {
  const [state, action, saving] = useActionState(saveLessonTypeAction, initialLessonTypeState);
  const [toggleState, toggle, toggling] = useActionState(toggleLessonTypeAction, initialLessonTypeState);
  const pending = saving || toggling;
  return <article className="lesson-type-row" aria-label={type.name}>
    <form action={action} className="subject-create-form">
      <input name="id" type="hidden" value={type.id} />
      <label>Назва типу
        <input key={type.name} name="name" defaultValue={type.name} minLength={2} maxLength={100} required disabled={pending} />
      </label>
      <button className="button button-light" disabled={pending}>{saving ? "Збереження…" : "Зберегти назву"}</button>
      <Message state={state} />
    </form>
    <form action={toggle} className="lesson-type-toggle">
      <input name="id" type="hidden" value={type.id} />
      <input name="active" type="hidden" value={String(!type.isActive)} />
      <span>{type.isActive ? "Активний" : "Неактивний — недоступний для нових занять"}</span>
      <button className="button button-light" disabled={pending}>
        {toggling ? "Зміна стану…" : type.isActive ? "Деактивувати" : "Активувати"}
      </button>
      <Message state={toggleState} />
    </form>
  </article>;
}

export function LessonTypeManager({ types }: { types: LessonType[] }) {
  const [state, action, pending] = useActionState(saveLessonTypeAction, initialLessonTypeState);
  return <div className="subject-manager">
    <form action={action} className="subject-create-form">
      <label>Новий тип заняття
        <input name="name" placeholder="Наприклад, консультація" minLength={2} maxLength={100} required disabled={pending} />
      </label>
      <button className="button button-primary" disabled={pending}>{pending ? "Додавання…" : "Додати тип"}</button>
      <Message state={state} />
    </form>
    <div className="lesson-type-list">
      {types.map((type) => <TypeRow key={type.id} type={type} />)}
      {!types.length && <p className="notice">Типів занять ще немає. Додайте перший тип.</p>}
    </div>
  </div>;
}
