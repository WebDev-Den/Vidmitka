"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { applyAudience, attendanceSummary, ATTENDANCE_LABELS, type AttendanceStudent, type AttendanceStatus } from "@/lib/attendance/rules";
import { saveAttendanceAction } from "./actions";
import { initialJournalState } from "./form-state";

export function JournalForm({ students, date, lessonKey, version, future }: {
  students: AttendanceStudent[]; date: string; lessonKey: string; version: number; future: boolean;
}) {
  const [rows, setRows] = useState(students);
  const [group, setGroup] = useState("");
  const [subgroup, setSubgroup] = useState("");
  const [dirty, setDirty] = useState(false);
  const [state, action, pending] = useActionState(saveAttendanceAction, initialJournalState);
  const router = useRouter();
  const summary = attendanceSummary(rows);
  const groups = [...new Set(rows.map((row) => row.groupName))].sort();
  const subgroups = [...new Set(rows.filter((row) => !group || row.groupName === group).map((row) => row.subgroup).filter(Boolean))].sort();
  const disabled = future || pending;

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function changeRows(next: AttendanceStudent[]) { setRows(next); setDirty(true); }
  return (
    <form action={action} className="journal-form">
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="lessonKey" value={lessonKey} />
      <input type="hidden" name="version" value={version} />
      <input type="hidden" name="marks" value={JSON.stringify(rows.map(({ studentId, status }) => ({ studentId, status })))} />
      <div className="lesson-editor journal-controls">
        <div className="settings-form-heading">
          <h2>Студенти заняття</h2>
          <p>Виберіть учасників цієї пари. Студенти інших груп / підгруп не вважатимуться відсутніми.</p>
        </div>
        <label>Група на занятті
          <select value={group} disabled={disabled} onChange={(event) => { setGroup(event.target.value); setSubgroup(""); }}>
            <option value="">Усі групи</option>
            {groups.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
        <label>Підгрупа на занятті
          <select value={subgroup} disabled={disabled} onChange={(event) => setSubgroup(event.target.value)}>
            <option value="">Усі підгрупи</option>
            {subgroups.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
        <div className="page-actions journal-wide">
          <button className="button button-light" type="button" disabled={disabled} onClick={() => changeRows(applyAudience(rows, group, subgroup))}>Застосувати склад заняття</button>
          <button className="button button-light" type="button" disabled={disabled} onClick={() => changeRows(rows.map((row) => row.status === "not_required" ? row : { ...row, status: "present" }))}>Усі потрібні присутні</button>
        </div>
      </div>
      <p className="notice" aria-live="polite">
        Присутні: {summary.present}/{summary.expected}{summary.percentage !== null ? ` (${summary.percentage}%)` : ""} · Пропуски: {summary.absent} · Не відмічено: {summary.unmarked} · Не потребують відмічання: {summary.notRequired}
      </p>
      <div className="schedule-table-wrap">
        <table className="schedule-table journal-table">
          <thead><tr><th scope="col">Студент</th><th scope="col">Група</th><th scope="col">Підгрупа</th><th scope="col">Відвідування</th></tr></thead>
          <tbody>{rows.map((row) => (
            <tr key={row.studentId}>
              <td><strong>{row.fullName}</strong></td><td>{row.groupName}</td><td>{row.subgroup || "—"}</td>
              <td><select aria-label={`Відвідування: ${row.fullName}, ${row.groupName}`} value={row.status} disabled={disabled}
                onChange={(event) => changeRows(rows.map((item) => item.studentId === row.studentId ? { ...item, status: event.target.value as AttendanceStatus } : item))}>
                {Object.entries(ATTENDANCE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div className="page-actions">
        <button className="button button-primary" type="submit" disabled={disabled || !rows.length}>{pending ? "Збереження…" : "Зберегти відмітки"}</button>
        {dirty && <span role="status">Є незбережені зміни</span>}
      </div>
      {future && <p className="notice">Майбутнє заняття: відмічання буде доступне в день проведення.</p>}
      {state.message && <p className={`period-action-message ${state.success ? "is-success" : "is-error"}`} role={state.success ? "status" : "alert"}>{state.message}</p>}
      {!state.success && state.message && <button type="button" className="button button-light" onClick={() => {
        if (window.confirm("Оновити журнал? Незбережені відмітки буде скинуто.")) router.refresh();
      }}>Оновити журнал</button>}
    </form>
  );
}
