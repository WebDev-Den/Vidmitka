"use client";

import { Download, FileJson2, FileSpreadsheet, Upload } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";

import { importScheduleAction } from "./actions";
import { initialImportScheduleActionState } from "./form-state";

export function ImportScheduleForm({
  subjects,
  rooms,
  periods,
  lessonTypes,
}: {
  subjects: string[];
  rooms: string[];
  periods: string[];
  lessonTypes: string[];
}) {
  const [state, formAction, pending] = useActionState(
    importScheduleAction,
    initialImportScheduleActionState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success, state.message]);

  return (
    <div className="management-stack">
      <form ref={formRef} action={formAction} className="lesson-editor compact-form">
        <div className="settings-form-heading">
          <h2>Файл розкладу</h2>
          <p>
            Імпорт виконується повністю або не виконується взагалі. Максимум —
            200 занять і 512 КБ за один раз.
          </p>
        </div>
        <label>
          JSON або CSV
          <input
            name="scheduleFile"
            type="file"
            accept=".json,.csv,application/json,text/csv"
            required
          />
        </label>
        <button className="button button-primary" type="submit" disabled={pending}>
          <Upload size={17} />
          {pending ? "Перевірка та імпорт…" : "Імпортувати розклад"}
        </button>
        {state.message ? (
          <div
            className={`period-action-message${state.success ? " is-success" : " is-error"}`}
            role={state.success ? "status" : "alert"}
          >
            <strong>{state.message}</strong>
            {state.errors.length > 0 ? (
              <ul>
                {state.errors.map((error) => <li key={error}>{error}</li>)}
              </ul>
            ) : null}
          </div>
        ) : null}
      </form>

      <section className="semester-end-panel management-panel" aria-labelledby="import-examples-title">
        <div>
          <span className="eyebrow">ПРИКЛАДИ</span>
          <h2 id="import-examples-title">Завантажити приклад імпорту</h2>
          <p>
            Збережіть структуру колонок і замініть демонстраційні значення на
            точні назви з активних довідників системи.
          </p>
          <p>Тип заняття: поле <code>lessonType</code> у JSON або «тип заняття» у CSV. Старі файли без цього поля сумісні; у них тип залишиться невказаним.</p>
        </div>
        <div className="page-actions">
          <a className="button button-light" href="/examples/schedule-import-example.json" download>
            <FileJson2 size={17} /> JSON <Download size={15} />
          </a>
          <a className="button button-light" href="/examples/schedule-import-example.csv" download>
            <FileSpreadsheet size={17} /> CSV <Download size={15} />
          </a>
        </div>
      </section>

      <details className="notice notice-info">
        <summary>Активні значення для імпорту</summary>
        <div>
          <p><strong>Предмети:</strong> {subjects.join(", ") || "не додано"}</p>
          <p><strong>Аудиторії:</strong> {rooms.join(", ") || "не додано"}</p>
          <p><strong>Пари:</strong> {periods.join(", ") || "не додано"}</p>
          <p><strong>Типи занять:</strong> {lessonTypes.join(", ") || "не додано"}</p>
        </div>
      </details>
    </div>
  );
}
