"use client";

import { CalendarX2 } from "lucide-react";
import { useActionState } from "react";
import type { FormEvent } from "react";

import {
  endSemesterAction,
  initialSemesterEndActionState,
} from "./actions";

export function SemesterEndForm() {
  const [state, formAction, pending] = useActionState(
    endSemesterAction,
    initialSemesterEndActionState,
  );

  function confirmSemesterEnd(event: FormEvent<HTMLFormElement>) {
    const confirmed = window.confirm(
      "Завершити семестр? Усі заняття поточного розкладу буде видалено. Студенти та їхні зв’язки з предметами залишаться.",
    );

    if (!confirmed) event.preventDefault();
  }

  return (
    <section className="semester-end-panel" aria-labelledby="semester-end-title">
      <div>
        <span className="eyebrow">СЕМЕСТР</span>
        <h2 id="semester-end-title">Завершення семестру</h2>
        <p>
          Операція повністю очистить розклад занять. Студенти, навчальні
          предмети та списки студентів за предметами будуть збережені.
        </p>
      </div>
      <form action={formAction} onSubmit={confirmSemesterEnd}>
        <button className="button button-light" type="submit" disabled={pending}>
          <CalendarX2 size={17} />
          {pending ? "Завершення…" : "Завершити семестр"}
        </button>
      </form>
      {state.message ? (
        <p
          className={`period-action-message${state.success ? " is-success" : " is-error"}`}
          role={state.success ? "status" : "alert"}
        >
          {state.message}
        </p>
      ) : null}
    </section>
  );
}
