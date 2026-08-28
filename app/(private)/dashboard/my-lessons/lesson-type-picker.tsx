"use client";

import { useActionState } from "react";
import { initialLessonState } from "../lessons/new/form-state";
import { updateLessonTypeAction } from "./actions";

export function LessonTypePicker({ lessonId, currentTypeId, currentTypeName, types }: {
  lessonId: string; currentTypeId: string | null; currentTypeName: string | null; types: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(updateLessonTypeAction, initialLessonState);
  const unavailable = currentTypeId !== null && !types.some((type) => type.id === currentTypeId);
  return <form action={action} className="lesson-type-picker">
    <input name="lessonId" type="hidden" value={lessonId} />
    <label>Тип заняття
      <select key={currentTypeId ?? "unset"} name="lessonTypeId" defaultValue={currentTypeId ?? ""} required disabled={pending}>
        <option value="" disabled>Тип не вказано</option>
        {unavailable && <option value={currentTypeId!} disabled>{currentTypeName} (неактивний)</option>}
        {types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
      </select>
    </label>
    <button className="button button-light" disabled={pending || !types.length}>{pending ? "Збереження…" : "Зберегти тип"}</button>
    {state.message && <p className={`period-action-message ${state.success ? "is-success" : "is-error"}`}
      role={state.success ? "status" : "alert"}>{state.message}</p>}
  </form>;
}
