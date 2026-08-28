"use client";

import { useActionState } from "react";
import { importStudentsAction } from "@/app/(private)/dashboard/journal/actions";
import { initialStudentImportState } from "@/app/(private)/dashboard/journal/form-state";

export function StudentImportForm({ lessonId, subjects }: {
  lessonId?: string; subjects?: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(importStudentsAction, initialStudentImportState);
  return (
    <details className="journal-import">
      <summary>Імпортувати студентів із CSV або JSON</summary>
      <form action={action} className="lesson-editor compact-form">
        <div className="settings-form-heading">
          <h2>Імпорт студентів до предмета</h2>
          <p>ПІБ, група та необов’язкова підгрупа. До 500 студентів, 512 КБ. У разі помилки весь файл не імпортується.</p>
          <p>{lessonId
            ? "Імпорт додає студентів до предмета й окремого списку цього заняття. Списки інших занять, сформовані вручну, не змінюються."
            : "Імпорт додає студентів до вашого предмета та довідника груп. До занять з окремими списками їх потрібно вибрати додатково."}</p>
          <div className="page-actions">
            <a className="button button-light" href="/examples/students-import-example.csv" download>Зразок CSV</a>
            <a className="button button-light" href="/examples/students-import-example.json" download>Зразок JSON</a>
          </div>
        </div>
        {lessonId ? <input type="hidden" name="lessonId" value={lessonId} /> : (
          <label>Предмет для імпорту
            <select name="subjectId" defaultValue="" required>
              <option value="" disabled>Оберіть предмет</option>
              {subjects?.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
            </select>
          </label>
        )}
        <label>Файл студентів
          <input type="file" name="studentsFile" accept=".csv,.json,text/csv,application/json" required />
        </label>
        <button className="button button-primary" type="submit" disabled={pending}>{pending ? "Імпортування…" : "Імпортувати студентів"}</button>
        {state.message && <div className={`period-action-message ${state.success ? "is-success" : "is-error"}`} role={state.success ? "status" : "alert"}>
          <p>{state.message}</p>
          {state.errors.length > 0 && <ul>{state.errors.map((error) => <li key={error}>{error}</li>)}</ul>}
        </div>}
      </form>
    </details>
  );
}
