"use client";

import { CalendarDays, Save, Trash2 } from "lucide-react";
import { useActionState } from "react";
import { LESSON_DAYS } from "@/lib/lessons/rules";
import type { MakeupDay } from "@/lib/schedule-calendar/rules";
import { formatWeekTypeLabel } from "@/lib/schedule-week/rules";
import { deleteMakeupDayAction, saveMakeupDayAction } from "./makeup-actions";
import { initialMakeupActionState, type MakeupActionState } from "./makeup-form-state";

function ActionMessage({ state }: { state: MakeupActionState }) {
  return state.message ? <p className={`period-action-message${state.success ? " is-success" : " is-error"}`}
    role={state.success ? "status" : "alert"}>{state.message}</p> : null;
}

function DayFields({ day, disabled }: { day?: MakeupDay; disabled: boolean }) {
  return <>
    <label>За розкладом дня
      <select name="dayOfWeek" defaultValue={day?.dayOfWeek ?? 1} disabled={disabled} required>
        {LESSON_DAYS.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}
      </select>
    </label>
    <label>Тип тижня
      <select name="weekType" defaultValue={day?.weekType ?? "numerator"} disabled={disabled} required>
        <option value="numerator">Чисельник</option>
        <option value="denominator">Знаменник</option>
      </select>
    </label>
  </>;
}

function MakeupDayRow({ day }: { day: MakeupDay }) {
  const [saved, saveAction, saving] = useActionState(saveMakeupDayAction, initialMakeupActionState);
  const [deleted, deleteAction, deleting] = useActionState(deleteMakeupDayAction, initialMakeupActionState);
  const disabled = day.hasJournal || saving || deleting;
  const dateLabel = day.date.split("-").reverse().join(".");
  return <article className="makeup-day-row" aria-label={`Відпрацювання ${dateLabel}`}>
    <form action={saveAction} className="lesson-editor">
      <div className="settings-form-heading">
        <h3>Відпрацювання · <time dateTime={day.date}>{dateLabel}</time></h3>
        <p>{LESSON_DAYS[day.dayOfWeek - 1]} · {formatWeekTypeLabel(day.weekType)}</p>
      </div>
      <input type="hidden" name="date" value={day.date} />
      <input type="hidden" name="version" value={day.version} />
      <DayFields key={`${day.version}:${day.hasJournal}`} day={day} disabled={disabled} />
      <button type="submit" className="button button-light" disabled={disabled}>
        <Save size={16} aria-hidden="true" />{saving ? "Збереження…" : "Зберегти зміни"}
      </button>
      {day.hasJournal && <p className="journal-wide">Дата захищена: вже збережено журнал. Редагування та видалення недоступні.</p>}
      <ActionMessage state={saved} />
    </form>
    <form action={deleteAction} className="makeup-day-delete" onSubmit={(event) => {
      if (!window.confirm(`Видалити відпрацювання ${dateLabel}? Для цієї дати знову діятиме звичайний розклад.`)) event.preventDefault();
    }}>
      <input type="hidden" name="date" value={day.date} />
      <input type="hidden" name="version" value={day.version} />
      <button className="button button-light" type="submit" disabled={disabled}>
        <Trash2 size={16} aria-hidden="true" />{deleting ? "Видалення…" : "Видалити відпрацювання"}
      </button>
      <ActionMessage state={deleted} />
    </form>
  </article>;
}

export function MakeupDaysManager({ days }: { days: MakeupDay[] }) {
  const [state, action, pending] = useActionState(saveMakeupDayAction, initialMakeupActionState);
  return <section className="makeup-days-manager" aria-labelledby="makeup-days-heading">
    <form action={action} className="lesson-editor">
      <div className="settings-form-heading">
        <h2 id="makeup-days-heading">Календар відпрацювань</h2>
        <p>Задайте дату, за розкладом якого дня й тижня проводяться заняття. Це замінює звичайний розклад усієї дати та не змінює чергування інших тижнів.</p>
      </div>
      <input type="hidden" name="version" value="0" />
      <label>Дата відпрацювання
        <input type="date" name="date" min="0001-01-01" max="9999-12-31" disabled={pending} required />
      </label>
      <DayFields disabled={pending} />
      <button className="button button-primary" type="submit" disabled={pending}>
        <CalendarDays size={17} aria-hidden="true" />{pending ? "Додавання…" : "Додати відпрацювання"}
      </button>
      <ActionMessage state={state} />
    </form>
    {days.length ? <div className="makeup-days-list">
      {days.map((day) => <MakeupDayRow key={day.date} day={day} />)}
    </div> : <p className="notice">Дат відпрацювань ще немає. Поки діє звичайний розклад.</p>}
  </section>;
}
