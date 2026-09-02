"use client";

import { CalendarDays, LockKeyhole, Save, Trash2 } from "lucide-react";
import { useActionState, useId } from "react";

import {
  ManagementFeedback,
  ManagementTable,
} from "@/components/private/management-table";
import {
  CALENDAR_DAY_LABELS,
  type CalendarOverride,
} from "@/lib/schedule-v2/calendar-override-rules";
import type { CalendarOverrideMutationResult } from "@/lib/schedule-v2/calendar-overrides";

import styles from "./calendar-override-manager.module.css";

const initialState: CalendarOverrideMutationResult = { success: false, message: "" };
type CalendarAction = (
  previousState: CalendarOverrideMutationResult,
  formData: FormData,
) => Promise<CalendarOverrideMutationResult>;

function DayAndWeekFields({
  formId,
  context,
  item,
  disabled,
}: {
  formId: string;
  context: string;
  item?: CalendarOverride;
  disabled: boolean;
}) {
  return <>
    <td>
      <label className="sr-only" htmlFor={`${formId}-day`}>За розкладом дня — {context}</label>
      <select id={`${formId}-day`} form={formId} name="dayOfWeek"
        defaultValue={item?.dayOfWeek ?? 1} disabled={disabled} required>
        {CALENDAR_DAY_LABELS.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}
      </select>
    </td>
    <td>
      <label className="sr-only" htmlFor={`${formId}-week`}>Тип тижня — {context}</label>
      <select id={`${formId}-week`} form={formId} name="weekType"
        defaultValue={item?.weekType ?? "numerator"} disabled={disabled} required>
        <option value="numerator">Чисельник</option>
        <option value="denominator">Знаменник</option>
      </select>
    </td>
  </>;
}

function NewCalendarOverrideRow({ action }: { action: CalendarAction }) {
  const formId = useId();
  const [state, formAction, pending] = useActionState(action, initialState);
  return <tbody className="management-new-row" aria-busy={pending}>
    <tr>
      <td>
        <label className="sr-only" htmlFor={`${formId}-date`}>Нова дата перенесення</label>
        <input id={`${formId}-date`} form={formId} name="date" type="date" disabled={pending} required />
      </td>
      <DayAndWeekFields formId={formId} context="нове перенесення" disabled={pending} />
      <td className="management-actions-cell">
        <form id={formId} action={formAction}>
          <input type="hidden" name="operation" value="save-calendar-override" />
          <input type="hidden" name="version" value="0" />
          <button className="button button-primary" disabled={pending}>
            <CalendarDays size={16} aria-hidden="true" /> {pending ? "Додавання…" : "Додати"}
          </button>
        </form>
      </td>
    </tr>
    <ManagementFeedback state={state} colSpan={4} />
  </tbody>;
}

function CalendarOverrideRow({ item, action }: { item: CalendarOverride; action: CalendarAction }) {
  const formId = useId();
  const [saved, saveAction, saving] = useActionState(action, initialState);
  const [deleted, deleteAction, deleting] = useActionState(action, initialState);
  const disabled = item.hasJournal || saving || deleting;
  const dateLabel = item.date.split("-").reverse().join(".");
  const protectionId = item.hasJournal ? `${formId}-protected` : undefined;

  return <tbody aria-busy={saving || deleting}>
    <tr>
      <th scope="row">
        <time dateTime={item.date}>{dateLabel}</time>
        {item.hasJournal ? <span className={styles.protected} id={protectionId}>
          <LockKeyhole size={13} aria-hidden="true" /> Є журнал
        </span> : null}
      </th>
      <DayAndWeekFields key={`${item.version}:${item.hasJournal}`} formId={formId}
        context={dateLabel} item={item} disabled={disabled} />
      <td className="management-actions-cell">
        <div className="management-actions">
          <form id={formId} action={saveAction}>
            <input type="hidden" name="operation" value="save-calendar-override" />
            <input type="hidden" name="date" value={item.date} />
            <input type="hidden" name="version" value={item.version} />
            <button className="button button-light" disabled={disabled} aria-describedby={protectionId}>
              <Save size={16} aria-hidden="true" /> {saving ? "Збереження…" : "Зберегти"}
            </button>
          </form>
          <form action={deleteAction} onSubmit={(event) => {
            if (!window.confirm(`Видалити перенесення ${dateLabel}?`)) event.preventDefault();
          }}>
            <input type="hidden" name="operation" value="delete-calendar-override" />
            <input type="hidden" name="date" value={item.date} />
            <input type="hidden" name="version" value={item.version} />
            <button className="icon-control" disabled={disabled} aria-describedby={protectionId}
              aria-label={`Видалити перенесення ${dateLabel}`}>
              <Trash2 size={16} aria-hidden="true" />
            </button>
          </form>
        </div>
      </td>
    </tr>
    {item.hasJournal ? <tr><td colSpan={4} className={styles.note}>
      Дата захищена, тому що для неї вже збережено журнал занять.
    </td></tr> : null}
    <ManagementFeedback state={saved} colSpan={4} />
    <ManagementFeedback state={deleted} colSpan={4} />
  </tbody>;
}

function RequestedDatesButton({ action }: { action: CalendarAction }) {
  const [state, formAction, pending] = useActionState(action, initialState);
  return <div className={styles.batch}>
    <form action={formAction} onSubmit={(event) => {
      if (!window.confirm("Додати або оновити 12 затверджених дат перенесень 2026 року?")) event.preventDefault();
    }}>
      <input type="hidden" name="operation" value="apply-requested-calendar-2026" />
      <button className="button button-light" disabled={pending}>
        <CalendarDays size={16} aria-hidden="true" />
        {pending ? "Застосування…" : "Додати 12 дат зі списку 2026"}
      </button>
    </form>
    {state.message ? <p className={`period-action-message ${state.success ? "is-success" : "is-error"}`}
      role={state.success ? "status" : "alert"}>{state.message}</p> : null}
  </div>;
}

export function CalendarOverrideManager({ items, action }: {
  items: readonly CalendarOverride[];
  action: CalendarAction;
}) {
  return <section className={styles.section} aria-labelledby="calendar-overrides-heading">
    <div className={styles.heading}>
      <div>
        <h2 id="calendar-overrides-heading">Перенесення навчальних днів</h2>
        <p>Вкажіть дату та розклад дня і тижня, який має діяти замість її звичайного розкладу.</p>
      </div>
      <RequestedDatesButton action={action} />
    </div>
    <ManagementTable caption="Календар перенесень навчальних днів" minWidth={720}
      columns={["Дата перенесення", "За розкладом дня", "Тип тижня", "Дії"]}>
      <NewCalendarOverrideRow action={action} />
      {items.map((item) => <CalendarOverrideRow key={item.date} item={item} action={action} />)}
    </ManagementTable>
    {!items.length ? <p className={styles.empty}>Перенесень ще немає. Діє звичайний календар.</p> : null}
  </section>;
}
