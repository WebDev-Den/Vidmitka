"use client";

import { useActionState, useId } from "react";
import { ManagementFeedback, ManagementStatus, ManagementTable } from "@/components/private/management-table";
import type { LessonType } from "@/lib/lesson-types/repository";
import { saveLessonTypeAction, toggleLessonTypeAction } from "./actions";
import { initialLessonTypeState } from "./form-state";

function TypeRow({ type }: { type: LessonType }) {
  const formId = useId();
  const [state, action, saving] = useActionState(saveLessonTypeAction, initialLessonTypeState);
  const [toggleState, toggle, toggling] = useActionState(toggleLessonTypeAction, initialLessonTypeState);
  const pending = saving || toggling;
  return <tbody>
    <tr>
      <td><input form={formId} key={type.name} name="name" defaultValue={type.name} minLength={2} maxLength={100}
        aria-label={"Назва типу: " + type.name} required disabled={pending} /></td>
      <td><ManagementStatus active={type.isActive} /></td>
      <td className="management-actions-cell"><div className="management-actions">
        <form id={formId} action={action}>
          <input name="id" type="hidden" value={type.id} />
          <button className="button button-light" disabled={pending} aria-label={"Зберегти назву: " + type.name}>
            {saving ? "Збереження…" : "Зберегти"}
          </button>
        </form>
        <form action={toggle}>
          <input name="id" type="hidden" value={type.id} />
          <input name="active" type="hidden" value={String(!type.isActive)} />
          <button className="button button-light" disabled={pending}
            aria-label={(type.isActive ? "Деактивувати: " : "Активувати: ") + type.name}>
            {toggling ? "Зміна стану…" : type.isActive ? "Деактивувати" : "Активувати"}
          </button>
        </form>
      </div></td>
    </tr>
    <ManagementFeedback state={state} colSpan={3} />
    <ManagementFeedback state={toggleState} colSpan={3} />
  </tbody>;
}

export function LessonTypeManager({ types }: { types: LessonType[] }) {
  const formId = useId();
  const [state, action, pending] = useActionState(saveLessonTypeAction, initialLessonTypeState);
  return <ManagementTable caption="Типи занять" columns={["Назва типу", "Стан", "Дії"]} minWidth={700}>
    <tbody>
      <tr className="management-new-row">
        <td><input form={formId} name="name" aria-label="Новий тип заняття" placeholder="Наприклад, консультація"
          minLength={2} maxLength={100} required disabled={pending} /></td>
        <td><span className="management-muted">Новий запис</span></td>
        <td><form id={formId} action={action}>
          <button className="button button-primary" disabled={pending}>{pending ? "Додавання…" : "Додати тип"}</button>
        </form></td>
      </tr>
      <ManagementFeedback state={state} colSpan={3} />
    </tbody>
    {types.map((type) => <TypeRow key={type.id} type={type} />)}
    {!types.length && <tbody><tr><td colSpan={3} className="management-muted">Типів занять ще немає. Додайте перший тип.</td></tr></tbody>}
  </ManagementTable>;
}
