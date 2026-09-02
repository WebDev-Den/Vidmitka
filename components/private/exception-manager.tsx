"use client";

import { Trash2 } from "lucide-react";
import { useActionState, useMemo, useState } from "react";

import { ManagementTable } from "@/components/private/management-table";
import type { ScheduleEntryView } from "@/lib/schedule-v2/entries";
import type { ScheduleExceptionMutationResult, ScheduleExceptionView } from "@/lib/schedule-v2/exceptions";
import type { ScheduleEditorOptions } from "@/lib/schedule-v2/options";

import styles from "./exception-manager.module.css";

const initialState: ScheduleExceptionMutationResult = { success: false, message: "" };
const KINDS = [
  ["move", "Перенесення на іншу дату"], ["reschedule", "Інша пара або час"], ["room_change", "Зміна аудиторії"],
  ["teacher_change", "Заміна викладача"], ["discipline_change", "Заміна дисципліни"], ["type_change", "Заміна типу заняття"],
  ["cancel", "Скасування"], ["one_time", "Разове заняття"],
] as const;

function Multiple({ name, label, options, defaults }: { name: string; label: string; options: readonly {id:string;label:string}[]; defaults?: readonly string[] }) {
  return <label>{label}<select name={name} multiple defaultValue={defaults ?? []}>{options.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>;
}

function ExceptionForm({ options, entries, action, exception }: {
  options: ScheduleEditorOptions; entries: readonly ScheduleEntryView[]; exception?: ScheduleExceptionView;
  action: (previousState: ScheduleExceptionMutationResult, formData: FormData) => Promise<ScheduleExceptionMutationResult>;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  return <form action={formAction} className={styles.form} aria-busy={pending}>
    <input type="hidden" name="operation" value={exception ? "update" : "create"} />
    {exception ? <input type="hidden" name="id" value={exception.id} /> : null}
    <label>Тип винятку<select name="kind" defaultValue={exception?.kind ?? "move"} required>{KINDS.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <label className={styles.double}>Базове заняття<select name="baseEntryId" defaultValue={exception?.baseEntryId ?? ""}>
      <option value="">Без базового запису — разове заняття</option>{entries.map((entry) => <option key={entry.id} value={entry.id}>{entry.discipline} · {entry.periodNumber} пара · {entry.groups.map((item) => item.name).join(", ")}</option>)}
    </select></label>
    <label>Початкова дата<input type="date" name="originalDate" defaultValue={exception?.originalDate ?? ""} required /></label>
    <label>Нова дата<input type="date" name="newDate" defaultValue={exception?.newDate ?? ""} /></label>
    <label>Нова пара<select name="periodId" defaultValue={exception?.periodId ?? ""}><option value="">Без зміни</option>{options.periods.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
    <label>Власний час від<input type="time" name="customStartTime" defaultValue={exception?.customStartTime ?? ""} /></label>
    <label>Власний час до<input type="time" name="customEndTime" defaultValue={exception?.customEndTime ?? ""} /></label>
    <label>Нова дисципліна<select name="disciplineId" defaultValue={exception?.disciplineId ?? ""}><option value="">Без зміни</option>{options.disciplines.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
    <label>Новий тип<select name="lessonTypeId" defaultValue={exception?.lessonTypeId ?? ""}><option value="">Без зміни</option>{options.lessonTypes.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
    <label>Статус<select name="status" defaultValue={exception?.status ?? "active"}><option value="active">Активний</option><option value="superseded">Замінений іншим</option><option value="cancelled">Скасований</option></select></label>
    <Multiple name="groupIds" label="Нові групи" options={options.groups} defaults={exception?.groups.map((item) => item.id)} />
    <Multiple name="teacherIds" label="Нові викладачі" options={options.teachers} defaults={exception?.teachers.map((item) => item.id)} />
    <Multiple name="roomIds" label="Нові аудиторії" options={options.rooms} defaults={exception?.rooms.map((item) => item.id)} />
    <label className={styles.double}>Причина<input name="reason" maxLength={500} defaultValue={exception?.reason ?? ""} /></label>
    <label>Примітка<input name="note" maxLength={500} defaultValue={exception?.note ?? ""} /></label>
    <div className={styles.actions}><button className="button button-primary" disabled={pending}>{pending ? "Збереження…" : exception ? "Зберегти виняток" : "Додати виняток"}</button></div>
    {state.message ? <p className={`${styles.message} period-action-message ${state.success ? "is-success" : "is-error"}`} role={state.success ? "status" : "alert"}>{state.message}</p> : null}
  </form>;
}

export function ExceptionManager({ exceptions, entries, options, action }: {
  exceptions: readonly ScheduleExceptionView[]; entries: readonly ScheduleEntryView[]; options: ScheduleEditorOptions;
  action: (previousState: ScheduleExceptionMutationResult, formData: FormData) => Promise<ScheduleExceptionMutationResult>;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [, deleteAction, deleting] = useActionState(action, initialState);
  const filtered = useMemo(() => {
    const value=query.trim().toLocaleLowerCase("uk-UA");
    return value ? exceptions.filter((item) => [item.originalDate,item.newDate,item.baseLabel,item.reason,item.note,
      ...item.groups.map((entry)=>entry.name),...item.teachers.map((entry)=>entry.name),...item.rooms.map((entry)=>entry.name)]
      .filter(Boolean).join(" ").toLocaleLowerCase("uk-UA").includes(value)) : exceptions;
  },[exceptions,query]);
  const pageCount=Math.max(1,Math.ceil(filtered.length/25));
  const currentPage=Math.min(page,pageCount-1);
  const visible=filtered.slice(currentPage*25,currentPage*25+25);
  return <div className={styles.stack}><ExceptionForm options={options} entries={entries} action={action} />
    <div className="management-actions"><label><span className="sr-only">Пошук винятків</span><input type="search" value={query}
      placeholder="Пошук за датою, заняттям або причиною" onChange={(event)=>{setQuery(event.currentTarget.value);setPage(0)}} /></label>
      <span className="management-muted">{filtered.length} записів</span></div>
    <ManagementTable caption="Переноси та винятки" columns={["Дата", "Тип", "Базове заняття", "Зміни", "Стан", "Дії"]} minWidth={980}>
      <tbody>{visible.flatMap((item) => [<tr key={item.id}><th scope="row">{item.originalDate.split("-").reverse().join(".")}{item.newDate ? <span className={styles.source}>→ {item.newDate.split("-").reverse().join(".")}</span> : null}</th>
        <td>{KINDS.find(([kind]) => kind === item.kind)?.[1] ?? item.kind}{item.sourceKind ? <span className={styles.source}>Імпорт JSON</span> : null}</td>
        <td>{item.baseLabel ?? "Разове заняття"}</td><td>{[item.groups.map((value) => value.name).join(", "), item.teachers.map((value) => value.name).join(", "), item.rooms.map((value) => value.name).join(", ")].filter(Boolean).join(" · ") || "Без заміни довідників"}</td>
        <td>{item.status === "active" ? "Активний" : item.status === "cancelled" ? "Скасований" : "Замінений"}</td>
        <td><div className="management-actions"><button type="button" className="button button-light" onClick={() => setEditing(editing === item.id ? null : item.id)}>{editing === item.id ? "Закрити" : "Редагувати"}</button>
          <form action={deleteAction} onSubmit={(event) => { if (!window.confirm("Видалити цей виняток?")) event.preventDefault(); }}><input type="hidden" name="id" value={item.id} />
            <button className="icon-control" name="operation" value="delete" disabled={deleting} aria-label="Видалити виняток"><Trash2 size={16} /></button></form></div></td></tr>,
        editing === item.id ? <tr key={`${item.id}-edit`}><td colSpan={6} className={styles.editCell}><ExceptionForm options={options} entries={entries} action={action} exception={item} /></td></tr> : null])}
      {!visible.length ? <tr><td colSpan={6}>Винятків не знайдено.</td></tr> : null}</tbody>
    </ManagementTable>
    {pageCount>1?<nav className="management-actions" aria-label="Сторінки винятків"><button className="button button-light" type="button" disabled={currentPage===0} onClick={()=>setPage((value)=>value-1)}>Назад</button><span>{currentPage+1} / {pageCount}</span><button className="button button-light" type="button" disabled={currentPage+1>=pageCount} onClick={()=>setPage((value)=>value+1)}>Далі</button></nav>:null}
  </div>;
}
