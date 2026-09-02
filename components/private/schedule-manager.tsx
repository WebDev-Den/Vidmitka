"use client";

import { Search, Trash2 } from "lucide-react";
import { useActionState, useMemo, useState } from "react";

import { ManagementStatus, ManagementTable } from "@/components/private/management-table";
import type { ScheduleEntryMutationResult, ScheduleEntryView } from "@/lib/schedule-v2/entries";
import type { ScheduleEditorOptions } from "@/lib/schedule-v2/options";

import styles from "./schedule-manager.module.css";

const initialState: ScheduleEntryMutationResult = { success: false, message: "" };
const DAYS = ["Понеділок", "Вівторок", "Середа", "Четвер", "П’ятниця", "Субота", "Неділя"];
const WEEK_LABELS = { numerator: "Перший тиждень", denominator: "Другий тиждень", both: "Щотижня" } as const;

function Fields({ options, entry }: { options: ScheduleEditorOptions; entry?: ScheduleEntryView }) {
  return <>
    <label>Дисципліна<select name="disciplineId" defaultValue={entry?.disciplineId ?? ""} required>
      <option value="" disabled>Оберіть дисципліну</option>{options.disciplines.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
    </select></label>
    <label>Тип заняття<select name="lessonTypeId" defaultValue={entry?.lessonTypeId ?? ""} required>
      <option value="" disabled>Оберіть тип</option>{options.lessonTypes.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
    </select></label>
    <label>День тижня<select name="dayOfWeek" defaultValue={entry?.dayOfWeek ?? 1} required>
      {DAYS.map((day, index) => <option key={day} value={index + 1}>{day}</option>)}
    </select></label>
    <label>Пара<select name="periodId" defaultValue={entry?.periodId ?? ""} required>
      <option value="" disabled>Оберіть пару</option>{options.periods.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
    </select></label>
    <label>Тип тижня<select name="weekPattern" defaultValue={entry?.weekPattern ?? "both"} required>
      <option value="both">Щотижня</option><option value="numerator">Перший тиждень</option><option value="denominator">Другий тиждень</option>
    </select></label>
    <label>Групи<select name="groupIds" multiple defaultValue={entry?.groups.map((item) => item.id) ?? []} required>
      {options.groups.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
    </select><span className={styles.hint}>Для кількох значень використайте Ctrl або Cmd.</span></label>
    <label>Викладачі<select name="teacherIds" multiple defaultValue={entry?.teachers.map((item) => item.id) ?? []} required>
      {options.teachers.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
    </select></label>
    <label>Аудиторії<select name="roomIds" multiple defaultValue={entry?.rooms.map((item) => item.id) ?? []}>
      {options.rooms.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
    </select><span className={styles.hint}>Можна не вибирати для дистанційного заняття.</span></label>
    <label>Діє від<input name="validFrom" type="date" defaultValue={entry?.validFrom ?? ""} /></label>
    <label>Діє до<input name="validUntil" type="date" defaultValue={entry?.validUntil ?? ""} /></label>
    <label className={styles.wide}>Примітка<textarea name="note" maxLength={500} defaultValue={entry?.note ?? ""} /></label>
  </>;
}

function EntryForm({ options, action, entry }: {
  options: ScheduleEditorOptions;
  action: (previousState: ScheduleEntryMutationResult, formData: FormData) => Promise<ScheduleEntryMutationResult>;
  entry?: ScheduleEntryView;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  return <form action={formAction} className={styles.form} aria-busy={pending}>
    {!entry ? <h2>Новий запис розкладу</h2> : null}
    <input type="hidden" name="operation" value={entry ? "update" : "create"} />
    {entry ? <input type="hidden" name="id" value={entry.id} /> : null}
    <Fields options={options} entry={entry} />
    <div className={styles.actions}><button className="button button-primary" disabled={pending}>
      {pending ? "Збереження…" : entry ? "Зберегти зміни" : "Створити запис"}
    </button></div>
    {state.message ? <p className={`${styles.message} period-action-message ${state.success ? "is-success" : "is-error"}`}
      role={state.success ? "status" : "alert"}>{state.message}</p> : null}
  </form>;
}

function EntryActions({ entry, action }: { entry: ScheduleEntryView; action: (previousState: ScheduleEntryMutationResult, formData: FormData) => Promise<ScheduleEntryMutationResult> }) {
  const [state, formAction, pending] = useActionState(action, initialState);
  return <div className="management-actions">
    <form action={formAction}><input type="hidden" name="id" value={entry.id} />
      <button className="button button-light" name="operation" value={entry.isActive ? "deactivate" : "activate"} disabled={pending}>
        {entry.isActive ? "Деактивувати" : "Активувати"}
      </button></form>
    <form action={formAction} onSubmit={(event) => { if (!window.confirm("Видалити цей запис розкладу?")) event.preventDefault(); }}>
      <input type="hidden" name="id" value={entry.id} /><button className="icon-control" name="operation" value="delete"
        disabled={pending} aria-label="Видалити запис"><Trash2 size={16} /></button>
    </form>
    {state.message ? <span className={state.success ? "is-success" : "is-error"} role={state.success ? "status" : "alert"}>{state.message}</span> : null}
  </div>;
}

export function ScheduleManager({ entries, options, action }: {
  entries: readonly ScheduleEntryView[];
  options: ScheduleEditorOptions;
  action: (previousState: ScheduleEntryMutationResult, formData: FormData) => Promise<ScheduleEntryMutationResult>;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const filtered = useMemo(() => {
    const value = query.trim().toLocaleLowerCase("uk-UA");
    return value ? entries.filter((entry) => [entry.discipline, entry.lessonType, ...entry.groups.map((item) => item.name),
      ...entry.teachers.map((item) => item.name), ...entry.rooms.map((item) => item.name)].join(" ").toLocaleLowerCase("uk-UA").includes(value)) : entries;
  }, [entries, query]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / 20));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(currentPage * 20, currentPage * 20 + 20);

  return <div className={styles.stack}>
    <EntryForm options={options} action={action} />
    <div className={styles.toolbar}><label className={styles.search}><Search size={17} aria-hidden="true" />
      <span className="sr-only">Пошук у розкладі</span><input type="search" value={query} placeholder="Пошук за групою, дисципліною або викладачем"
        onChange={(event) => { setQuery(event.currentTarget.value); setPage(0); }} /></label>
      <span className="management-muted">{filtered.length} записів</span></div>
    <ManagementTable caption="Базовий розклад" columns={["День / пара", "Дисципліна", "Групи", "Викладачі / аудиторії", "Тиждень", "Стан", "Дії"]} minWidth={1120}>
      <tbody>{visible.flatMap((entry) => {
        const editing = editingId === entry.id;
        return [<tr key={entry.id}>
          <td><div className={styles.summary}><strong>{DAYS[entry.dayOfWeek - 1]}</strong><small>{entry.periodNumber} пара · {entry.periodTime}</small></div></td>
          <th scope="row"><div className={styles.summary}><strong>{entry.discipline}</strong><small>{entry.lessonType}</small></div></th>
          <td>{entry.groups.map((item) => item.name).join(", ")}</td>
          <td><div className={styles.summary}><span>{entry.teachers.map((item) => item.name).join(", ")}</span><small>{entry.rooms.map((item) => item.name).join(", ") || "Дистанційно / не вказано"}</small></div></td>
          <td>{WEEK_LABELS[entry.weekPattern]}</td><td><ManagementStatus active={entry.isActive} /></td>
          <td><button type="button" className="button button-light" onClick={() => setEditingId(editing ? null : entry.id)}>{editing ? "Закрити" : "Редагувати"}</button>
            <EntryActions entry={entry} action={action} /></td>
        </tr>, editing ? <tr key={`${entry.id}-edit`} className={styles.editRow}><td colSpan={7}><EntryForm options={options} action={action} entry={entry} /></td></tr> : null];
      })}</tbody>
    </ManagementTable>
    {pageCount > 1 ? <nav className={styles.pagination} aria-label="Сторінки розкладу"><button className="button button-light" disabled={currentPage === 0} onClick={() => setPage((value) => value - 1)}>Назад</button>
      <span>{currentPage + 1} / {pageCount}</span><button className="button button-light" disabled={currentPage + 1 >= pageCount} onClick={() => setPage((value) => value + 1)}>Далі</button></nav> : null}
  </div>;
}
