"use client";

import { AlertTriangle, CheckCircle2, FileJson2, SearchCheck, Upload } from "lucide-react";
import { useActionState } from "react";

import { processScheduleImportAction } from "./actions";
import { initialAdminImportState } from "./form-state";

export function AdminScheduleImportForm() {
  const [state, action, pending] = useActionState(processScheduleImportAction, initialAdminImportState);
  const ready = state.status === "preview" && state.errors.length === 0 &&
    (state.database?.missingPeriods.length ?? 0) === 0;

  return <form action={action} className="management-stack">
    <section className="management-panel compact-form">
      <div className="settings-form-heading">
        <h2>JSON-файл розкладу</h2>
        <p>Спочатку виконайте preview. Запис почнеться лише після окремого підтвердження.</p>
      </div>
      <label>Файл JSON
        <input name="scheduleFile" type="file" accept=".json,application/json" required />
      </label>
      <div className="page-actions">
        <button className="button button-light" name="operation" value="preview" type="submit" disabled={pending}>
          <SearchCheck size={17} /> {pending ? "Аналіз…" : "Перевірити файл"}
        </button>
        {ready ? <button className="button button-primary" name="operation" value="commit" type="submit" disabled={pending}>
          <Upload size={17} /> {pending ? "Імпорт…" : "Підтвердити імпорт"}
        </button> : null}
      </div>
      {ready && state.warnings.length > 0 ? <label className="import-confirmation">
        <input name="confirmWarnings" type="checkbox" />
        Я перевірив попередження про конфлікти та підтверджую імпорт.
      </label> : null}
    </section>

    {state.message ? <section className={`notice ${state.status === "committed" ? "notice-success" : "notice-info"}`}
      role={state.status === "error" ? "alert" : "status"}>
      {state.status === "committed" ? <CheckCircle2 size={19} /> : <FileJson2 size={19} />}
      <div><strong>{state.message}</strong>{state.fileName ? <p>{state.fileName}</p> : null}</div>
    </section> : null}

    {state.summary ? <section className="management-panel" aria-labelledby="import-summary-title">
      <h2 id="import-summary-title">Підсумок preview</h2>
      <div className="dashboard-grid">
        <article className="dashboard-card"><strong>{state.summary.totalRows}</strong><span>записів у файлі</span></article>
        <article className="dashboard-card"><strong>{state.database?.createCount ?? 0}</strong><span>буде створено</span></article>
        <article className="dashboard-card"><strong>{state.database?.updateCount ?? 0}</strong><span>буде оновлено</span></article>
        <article className="dashboard-card"><strong>{state.database?.skipCount ?? 0}</strong><span>без змін</span></article>
      </div>
      <p>Довідники: {state.summary.teachers} викладачів, {state.summary.disciplines} дисципліни, {state.summary.rooms} аудиторій, {state.summary.groups} груп, {state.summary.lessonTypes} типи занять.</p>
      {state.database ? <p>Нові довідники: {state.database.newCatalogs.teachers} викладачів, {state.database.newCatalogs.disciplines} дисциплін, {state.database.newCatalogs.rooms} аудиторій, {state.database.newCatalogs.groups} груп, {state.database.newCatalogs.lessonTypes} типів.</p> : null}
      {state.database?.missingPeriods.length ? <p className="auth-field-error">Відсутні активні пари: {state.database.missingPeriods.join(", ")}.</p> : null}
    </section> : null}

    {state.errors.length > 0 ? <IssueList title="Помилки" issues={state.errors} error /> : null}
    {state.warnings.length > 0 ? <IssueList title="Попередження" issues={state.warnings} /> : null}
  </form>;
}

function IssueList({ title, issues, error = false }: {
  title: string;
  issues: readonly { rowNumber?: number; code: string; message: string }[];
  error?: boolean;
}) {
  return <section className={`management-panel${error ? " import-errors" : ""}`}>
    <h2><AlertTriangle size={18} /> {title}</h2>
    <div className="management-table-scroll" role="region" tabIndex={0} aria-label={title}>
      <table className="management-table"><thead><tr><th>Рядок</th><th>Код</th><th>Опис</th></tr></thead>
        <tbody>{issues.map((issue, index) => <tr key={`${issue.code}-${issue.rowNumber ?? index}`}>
          <td>{issue.rowNumber ?? "—"}</td><td><code>{issue.code}</code></td><td>{issue.message}</td>
        </tr>)}</tbody></table>
    </div>
  </section>;
}
