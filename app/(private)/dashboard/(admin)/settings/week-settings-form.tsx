"use client";

import { Save } from "lucide-react";
import { useActionState, useState } from "react";

import {
  formatWeekTypeLabel,
  getNumeratorAnchorDate,
  getWeekStartDate,
  getWeekTypeForDate,
  validateScheduleWeekSettings,
  type ScheduleWeekSettings,
} from "@/lib/schedule-week/rules";

import { saveWeekSettingsAction } from "./actions";
import { initialWeekSettingsActionState } from "./form-state";

export function WeekSettingsForm({
  settings,
  today,
}: {
  settings: ScheduleWeekSettings | null;
  today: string;
}) {
  const [state, formAction, pending] = useActionState(
    saveWeekSettingsAction,
    initialWeekSettingsActionState,
  );
  const [numeratorDate, setNumeratorDate] = useState(() =>
    settings ? getNumeratorAnchorDate(settings) : "",
  );
  const preview = validateScheduleWeekSettings({ numeratorDate });

  return (
    <form action={formAction} className="lesson-editor">
      <div className="settings-form-heading">
        <h2>Чергування навчальних тижнів</h2>
        <p>
          Вкажіть будь-яку дату відомого тижня-чисельника. Весь цей тиждень
          з понеділка до неділі буде чисельником, наступний — знаменником,
          далі — знову чисельником. Щотижня змінювати налаштування не потрібно.
        </p>
      </div>
      <label>
        Дата тижня-чисельника
        <input
          name="numeratorDate"
          type="date"
          min="0001-01-01"
          max="9999-12-31"
          value={numeratorDate}
          onInput={(event) => setNumeratorDate(event.currentTarget.value)}
          aria-describedby="numerator-date-help"
          disabled={pending}
          required
        />
      </label>
      <p id="numerator-date-help">
        Чергування спільне для всіх користувачів. Зміна тижня відбувається
        в понеділок за київським часом.
      </p>
      {preview.ok ? (
        <p aria-live="polite">
          Попередній розрахунок: тиждень із{" "}
          {getWeekStartDate(preview.value.anchorDate).split("-").reverse().join(".")}
          {" "}— чисельник. Поточний тиждень ({today.split("-").reverse().join(".")}):{" "}
          {formatWeekTypeLabel(getWeekTypeForDate(today, preview.value))}.
          {" "}Налаштування застосовується після збереження.
        </p>
      ) : null}
      <button className="button button-primary" type="submit" disabled={pending}>
        <Save size={17} />
        {pending ? "Збереження…" : "Зберегти дату чисельника"}
      </button>
      {state.message ? (
        <p
          className={`period-action-message${state.success ? " is-success" : " is-error"}`}
          role={state.success ? "status" : "alert"}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
