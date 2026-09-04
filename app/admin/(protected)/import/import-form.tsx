"use client";

import { AlertTriangle, CheckCircle2, Download, FileJson2, SearchCheck, Upload } from "lucide-react";
import { useActionState, useState } from "react";

import { processScheduleImportAction } from "./actions";
import { initialAdminImportState } from "./form-state";
import { MAX_TRANSFER_BYTES } from "@/lib/schedule-transfer/schema";
import styles from "./transfer.module.css";

export function AdminScheduleImportForm() {
  const [file, setFile] = useState<File | null>(null);
  const [selection, setSelection] = useState(0);
  const [checkedSelection, setCheckedSelection] = useState(-1);
  const [confirmWarnings, setConfirmWarnings] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [state, action, pending] = useActionState(async (previous: typeof initialAdminImportState, data: FormData) => {
    if (file) data.set("scheduleFile", file);
    try { return await processScheduleImportAction(previous, data); }
    catch { return { ...initialAdminImportState, status: "error" as const, message: "Не вдалося завершити запит. Перевірте з’єднання та сесію адміністратора; виконайте dry-run повторно." }; }
    finally { setCheckedSelection(selection); setConfirmWarnings(false); }
  }, initialAdminImportState);
  const current = checkedSelection === selection;
  const ready = current && state.status === "preview" && state.errors.length === 0 && (state.database?.missingPeriods.length ?? 0) === 0;
  const fileError = file && file.size > MAX_TRANSFER_BYTES ? "Файл завеликий: максимум 3 МБ." : "";
  const counts = state.transfer?.counts ?? (state.database ? [{ section: "entries", label: "Заняття",
    created: state.database.createCount, updated: state.database.updateCount, unchanged: state.database.skipCount }] : []);

  async function downloadSnapshot() {
    setExporting(true); setExportError("");
    try {
      const response = await fetch("/admin/import/export", { cache: "no-store" });
      if (response.redirected || !response.ok || !response.headers.get("content-disposition")) {
        throw new Error(response.redirected ? "Сесія завершилася. Увійдіть в адмінку ще раз." : "Не вдалося завантажити експорт. Спробуйте ще раз.");
      }
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = response.headers.get("content-disposition")?.match(/filename="([^"]+)"/u)?.[1] ?? "vidmitka-schedule.json";
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { setExportError(error instanceof Error ? error.message : "Не вдалося завантажити експорт."); }
    finally { setExporting(false); }
  }

  return <div className={styles.stack}>
    <section className={styles.export} aria-labelledby="schedule-export-title">
      <div><h2 id="schedule-export-title">Поточний розклад</h2>
        <p>Усі збережені заняття, винятки, довідники, пари й календар. JSON можна імпортувати назад.</p></div>
      <button className="button button-light" type="button" onClick={downloadSnapshot} disabled={exporting || pending}>
        <Download size={17} aria-hidden="true" />{exporting ? "Експорт…" : "Експортувати JSON"}
      </button>
      {exportError ? <p className={styles.error} role="alert">{exportError}</p> : null}
    </section>

    <form action={action} className={styles.stack} aria-busy={pending}>
      <section className={styles.panel} aria-labelledby="schedule-import-title">
        <h2 id="schedule-import-title">Імпорт файлу</h2>
        <p>Спочатку dry-run — перевірка без збереження. Записи поза файлом не видаляються.</p>
        <label className={styles.fileLabel} htmlFor="schedule-file">JSON-файл</label>
        <input id="schedule-file" name="scheduleFile" type="file" accept=".json,application/json"
          className={styles.fileInput} disabled={pending} aria-describedby="schedule-file-help"
          onChange={(event) => { setFile(event.target.files?.[0] ?? null); setSelection((value) => value + 1); setConfirmWarnings(false); }} />
        <p id="schedule-file-help" className={styles.help}>До 3 МБ. Експорт Vidmitka або попередній формат teacher-schedule.</p>
        {file ? <p className={styles.selectedFile}><FileJson2 size={16} aria-hidden="true" />{file.name} · {(file.size / 1024).toFixed(1)} КБ</p> : null}
        {fileError ? <p className={styles.error} role="alert">{fileError}</p> : null}
        <div className={styles.actions}>
          <button className="button button-light" name="operation" value="preview" type="submit" disabled={pending || !file || Boolean(fileError)}>
            <SearchCheck size={17} aria-hidden="true" />{pending ? "Обробка файлу…" : "Перевірити без збереження (dry-run)"}
          </button>
        </div>
      </section>

      {current && state.message ? <div className={`${styles.notice} ${state.status === "error" ? styles.error : ""}`}
        role={state.status === "error" ? "alert" : "status"}>
        {state.status === "committed" ? <CheckCircle2 size={19} aria-hidden="true" /> : <FileJson2 size={19} aria-hidden="true" />}
        <span>{state.message}</span>
      </div> : null}

      {current && counts.length ? <section className={styles.panel} aria-labelledby="import-summary-title">
        <h2 id="import-summary-title">{state.status === "committed" ? "Результат імпорту" : "Результат dry-run"}</h2>
        <div className={styles.tableScroll} role="region" tabIndex={0} aria-label="Підсумок імпорту">
          <table className={styles.table}><thead><tr><th>Розділ</th><th>Нові</th><th>Оновлення</th><th>Без змін</th></tr></thead>
            <tbody>{counts.map((row) => <tr key={row.section}><th scope="row">{row.label}</th>
              <td>{row.created}</td><td>{row.updated}</td><td>{row.unchanged}</td></tr>)}</tbody>
          </table>
        </div>
        {state.database ? <p className={styles.help}>Нові довідники: {state.database.newCatalogs.teachers} викладачів, {state.database.newCatalogs.disciplines} дисциплін, {state.database.newCatalogs.rooms} аудиторій, {state.database.newCatalogs.groups} груп, {state.database.newCatalogs.lessonTypes} типів.</p> : null}
        {state.database?.missingPeriods.length ? <p className={styles.error}>Відсутні активні пари: {state.database.missingPeriods.join(", ")}.</p> : null}
      </section> : null}

      {current && state.errors.length > 0 ? <IssueList title="Помилки — імпорт недоступний" issues={state.errors} /> : null}
      {current && state.warnings.length > 0 ? <IssueList title="Попередження" issues={state.warnings} /> : null}

      {ready ? <section className={styles.confirm} aria-label="Підтвердження імпорту">
        {state.warnings.length > 0 ? <label className={styles.checkbox}>
          <input name="confirmWarnings" type="checkbox" checked={confirmWarnings} disabled={pending}
            onChange={(event) => setConfirmWarnings(event.target.checked)} />
          Я перевірив попередження та підтверджую імпорт.
        </label> : null}
        <p>Лише ця дія записує зміни в базу даних.</p>
        <button className="button button-primary" name="operation" value="commit" type="submit"
          disabled={pending || (state.warnings.length > 0 && !confirmWarnings)}>
          <Upload size={17} aria-hidden="true" />{pending ? "Імпорт…" : "Підтвердити та імпортувати"}
        </button>
      </section> : null}
    </form>
  </div>;
}

function IssueList({ title, issues }: { title: string; issues: readonly { rowNumber?: number; code: string; message: string }[] }) {
  return <section className={styles.panel}>
    <h2><AlertTriangle size={18} aria-hidden="true" />{title}</h2>
    <ul className={styles.issues}>{issues.map((issue, index) => <li key={index}>
      {issue.rowNumber ? `Рядок ${issue.rowNumber}: ` : ""}{issue.message}
    </li>)}</ul>
  </section>;
}
