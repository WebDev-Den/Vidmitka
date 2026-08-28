"use client";

import { CalendarDays, LockKeyhole, Save, Trash2 } from "lucide-react";
import { useActionState, useId } from "react";

import { LESSON_DAYS } from "@/lib/lessons/rules";
import type { MakeupDay } from "@/lib/schedule-calendar/rules";

import { deleteMakeupDayAction, saveMakeupDayAction } from "./makeup-actions";
import { initialMakeupActionState, type MakeupActionState } from "./makeup-form-state";
import styles from "./settings.module.css";

function ActionMessage({ state }: { state: MakeupActionState }) {
  return state.message ? (
    <p
      className={`period-action-message${state.success ? " is-success" : " is-error"}`}
      role={state.success ? "status" : "alert"}
    >
      {state.message}
    </p>
  ) : null;
}

function DayFields({
  day,
  disabled,
  formId,
  context,
  describedBy,
}: {
  day?: MakeupDay;
  disabled: boolean;
  formId: string;
  context: string;
  describedBy?: string;
}) {
  return (
    <>
      <td>
        <label className="sr-only" htmlFor={`${formId}-day`}>
          За розкладом дня — {context}
        </label>
        <select
          id={`${formId}-day`}
          form={formId}
          name="dayOfWeek"
          defaultValue={day?.dayOfWeek ?? 1}
          aria-describedby={describedBy}
          disabled={disabled}
          required
        >
          {LESSON_DAYS.map((label, index) => (
            <option key={label} value={index + 1}>{label}</option>
          ))}
        </select>
      </td>
      <td>
        <label className="sr-only" htmlFor={`${formId}-week`}>
          Тип тижня — {context}
        </label>
        <select
          id={`${formId}-week`}
          form={formId}
          name="weekType"
          defaultValue={day?.weekType ?? "numerator"}
          aria-describedby={describedBy}
          disabled={disabled}
          required
        >
          <option value="numerator">Чисельник</option>
          <option value="denominator">Знаменник</option>
        </select>
      </td>
    </>
  );
}

function NewMakeupDayRow() {
  const formId = useId();
  const [state, action, pending] = useActionState(saveMakeupDayAction, initialMakeupActionState);

  return (
    <tbody className={styles.calendarCreateRow} aria-busy={pending}>
      <tr aria-label="Нове відпрацювання">
        <td>
          <label className="sr-only" htmlFor={`${formId}-date`}>Дата відпрацювання</label>
          <input
            id={`${formId}-date`}
            form={formId}
            type="date"
            name="date"
            min="0001-01-01"
            max="9999-12-31"
            disabled={pending}
            required
          />
        </td>
        <DayFields formId={formId} context="нове відпрацювання" disabled={pending} />
        <td>
          <form id={formId} action={action} className={styles.rowActions} aria-label="Додати відпрацювання">
            <input type="hidden" name="version" value="0" />
            <button
              className="button button-primary"
              type="submit"
              disabled={pending}
              aria-label={pending ? "Додавання відпрацювання…" : "Додати відпрацювання"}
            >
              <CalendarDays size={17} aria-hidden="true" />
              {pending ? "Додавання…" : "Додати"}
            </button>
          </form>
        </td>
      </tr>
      {state.message ? (
        <tr>
          <td colSpan={4} className={styles.feedbackCell}>
            <ActionMessage state={state} />
          </td>
        </tr>
      ) : null}
    </tbody>
  );
}

function MakeupDayRow({ day }: { day: MakeupDay }) {
  const formId = useId();
  const [saved, saveAction, saving] = useActionState(saveMakeupDayAction, initialMakeupActionState);
  const [deleted, deleteAction, deleting] = useActionState(deleteMakeupDayAction, initialMakeupActionState);
  const disabled = day.hasJournal || saving || deleting;
  const dateLabel = day.date.split("-").reverse().join(".");
  const protectionId = day.hasJournal ? `${formId}-protection` : undefined;

  return (
    <tbody aria-busy={saving || deleting}>
      <tr aria-label={`Відпрацювання ${dateLabel}`}>
        <th scope="row">
          <time className={styles.calendarDate} dateTime={day.date}>{dateLabel}</time>
          {day.hasJournal ? (
            <span className={styles.protectedDate}>
              <LockKeyhole size={14} aria-hidden="true" /> Є журнал
            </span>
          ) : null}
        </th>
        <DayFields
          key={`${day.version}:${day.hasJournal}`}
          day={day}
          disabled={disabled}
          formId={formId}
          context={dateLabel}
          describedBy={protectionId}
        />
        <td>
          <div className={styles.rowActions}>
            <form id={formId} action={saveAction} aria-label={`Зберегти відпрацювання ${dateLabel}`}>
              <input type="hidden" name="date" value={day.date} />
              <input type="hidden" name="version" value={day.version} />
              <button
                type="submit"
                className="button button-light"
                disabled={disabled}
                aria-describedby={protectionId}
                aria-label={`${saving ? "Збереження змін" : "Зберегти зміни"} — ${dateLabel}`}
              >
                <Save size={16} aria-hidden="true" />
                {saving ? "Збереження…" : "Зберегти"}
              </button>
            </form>
            <form action={deleteAction} onSubmit={(event) => {
              if (!window.confirm(`Видалити відпрацювання ${dateLabel}? Для цієї дати знову діятиме звичайний розклад.`)) {
                event.preventDefault();
              }
            }}>
              <input type="hidden" name="date" value={day.date} />
              <input type="hidden" name="version" value={day.version} />
              <button
                className={`button button-light ${styles.deleteButton}`}
                type="submit"
                disabled={disabled}
                aria-describedby={protectionId}
                aria-label={`${deleting ? "Видалення відпрацювання" : "Видалити відпрацювання"} ${dateLabel}`}
                title={`Видалити відпрацювання ${dateLabel}`}
              >
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </form>
          </div>
        </td>
      </tr>
      {day.hasJournal || saved.message || deleted.message ? (
        <tr>
          <td colSpan={4} className={styles.feedbackCell}>
            <div className={styles.rowFeedback}>
              {day.hasJournal ? (
                <p id={protectionId} className={styles.protectionNote}>
                  Дата захищена: вже збережено журнал. Редагування та видалення недоступні.
                </p>
              ) : null}
              <ActionMessage state={saved} />
              <ActionMessage state={deleted} />
            </div>
          </td>
        </tr>
      ) : null}
    </tbody>
  );
}

export function MakeupDaysManager({ days }: { days: MakeupDay[] }) {
  return (
    <section className={styles.makeupCalendar} aria-labelledby="makeup-days-heading">
      <div className={`settings-form-heading ${styles.calendarHeading}`}>
        <h2 id="makeup-days-heading">Календар відпрацювань</h2>
        <p>Задайте дату, за розкладом якого дня й тижня проводяться заняття. Це замінює звичайний розклад усієї дати та не змінює чергування інших тижнів.</p>
      </div>
      <p className={styles.tableHint} id="makeup-table-hint">
        Прокрутіть таблицю вбік, щоб побачити всі поля та дії.
      </p>
      <div
        className={styles.calendarTableScroll}
        role="region"
        aria-label="Таблиця відпрацювань"
        aria-describedby="makeup-table-hint"
        tabIndex={0}
      >
        <table className={styles.calendarTable}>
          <caption className="sr-only">Додавання та редагування дат відпрацювань</caption>
          <colgroup>
            <col className={styles.dateColumn} />
            <col className={styles.dayColumn} />
            <col className={styles.weekColumn} />
            <col className={styles.actionsColumn} />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Дата відпрацювання</th>
              <th scope="col">За розкладом дня</th>
              <th scope="col">Тип тижня</th>
              <th scope="col">Дії</th>
            </tr>
          </thead>
          <NewMakeupDayRow />
          {days.map((day) => <MakeupDayRow key={day.date} day={day} />)}
        </table>
      </div>
      {!days.length ? (
        <p className={styles.calendarEmpty}>
          Дат відпрацювань ще немає. Поки діє звичайний розклад.
        </p>
      ) : null}
    </section>
  );
}
