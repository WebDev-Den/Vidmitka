"use client";

import { Save } from "lucide-react";
import { useActionState } from "react";

import type { ScheduleWeekConfiguration, ScheduleWeekSettingsResult } from "@/lib/schedule-week/repository";

import { saveWeekConfigurationAction } from "./actions";

const initialState: ScheduleWeekSettingsResult = { success: false, message: "" };

export function WeekSettingsForm({ settings }: { settings: ScheduleWeekConfiguration | null }) {
  const [state, action, pending] = useActionState(saveWeekConfigurationAction, initialState);
  return <form action={action} className="lesson-editor">
    <div className="settings-form-heading"><h2>Чергування першого й другого тижня</h2><p>Оберіть будь-яку відому дату та її тип. Межа тижня — понеділок; далі тип автоматично змінюється кожні сім днів.</p></div>
    <label>Базова дата<input type="date" name="anchorDate" defaultValue={settings?.anchorDate ?? ""} required disabled={pending} /></label>
    <label>Тип базового тижня<select name="anchorWeekType" defaultValue={settings?.anchorWeekType ?? "numerator"} disabled={pending}>
      <option value="numerator">Перший тиждень</option><option value="denominator">Другий тиждень</option></select></label>
    <label>Початок семестру<input type="date" name="semesterStart" defaultValue={settings?.semesterStart ?? ""} disabled={pending} /></label>
    <label>Завершення семестру<input type="date" name="semesterEnd" defaultValue={settings?.semesterEnd ?? ""} disabled={pending} /></label>
    <button className="button button-primary" disabled={pending}><Save size={17} />{pending ? "Збереження…" : "Зберегти налаштування"}</button>
    {state.message ? <p className={`period-action-message ${state.success ? "is-success" : "is-error"}`} role={state.success ? "status" : "alert"}>{state.message}</p> : null}
  </form>;
}
