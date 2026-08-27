"use client";

import { Save } from "lucide-react";
import { useActionState } from "react";

import type { ScheduleWeekSettings } from "@/lib/schedule-week/rules";

import {
  initialWeekSettingsActionState,
  saveWeekSettingsAction,
} from "./actions";

export function WeekSettingsForm({
  settings,
}: {
  settings: ScheduleWeekSettings | null;
}) {
  const [state, formAction, pending] = useActionState(
    saveWeekSettingsAction,
    initialWeekSettingsActionState,
  );

  return (
    <form action={formAction} className="lesson-editor">
      <div className="settings-form-heading">
        <h2>Чергування навчальних тижнів</h2>
        <p>
          Виберіть понеділок відомого тижня та вкажіть його тип. Наступні
          тижні система визначатиме автоматично.
        </p>
      </div>
      <label>
        Опорний понеділок
        <input
          name="anchorDate"
          type="date"
          defaultValue={settings?.anchorDate}
          required
        />
      </label>
      <label>
        Тип опорного тижня
        <select
          name="anchorWeekType"
          defaultValue={settings?.anchorWeekType ?? "numerator"}
          required
        >
          <option value="numerator">Чисельник</option>
          <option value="denominator">Знаменник</option>
        </select>
      </label>
      <button className="button button-primary" type="submit" disabled={pending}>
        <Save size={17} />
        {pending ? "Збереження…" : "Зберегти чергування"}
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
