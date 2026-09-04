"use client";

import { RefreshCw } from "lucide-react";
import { useActionState, useId } from "react";

import { ManagementTable } from "@/components/private/management-table";
import { initializeQStashCronAction } from "@/app/admin/(protected)/cron/actions";
import { initialCronActionState } from "@/app/admin/(protected)/cron/form-state";
import type { QStashScheduleState, QStashSchedulerStatus } from "@/lib/public-push/qstash-schedules";

const stateLabel: Record<QStashScheduleState, string> = {
  ready: "Готовий",
  missing: "Не створено",
  paused: "На паузі",
  outdated: "Потрібне оновлення",
  unavailable: "Немає зв’язку",
  "not-configured": "Не налаштовано",
};

const kyivDateFormatter = new Intl.DateTimeFormat("uk-UA", {
  timeZone: "Europe/Kyiv",
  dateStyle: "medium",
  timeStyle: "short",
});

function formatTimestamp(value: string | null): string {
  if (!value) return "Ще не було";

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Немає даних" : kyivDateFormatter.format(date);
}

export function CronManager({ status }: { status: QStashSchedulerStatus }) {
  const [actionState, action, pending] = useActionState(initializeQStashCronAction, initialCronActionState);
  const messageId = useId();
  const hasConfigurationProblem = !status.configured;

  return <div className="management-stack scheduler-manager">
    <p className={`scheduler-summary${status.reachable ? " is-ready" : ""}`} id={messageId} role={status.reachable ? "status" : "alert"}>
      {status.message}
    </p>

    <ManagementTable
      caption="Стан QStash cron-запусків"
      columns={["Запуск", "Cron", "Стан", "Останній запуск QStash", "Наступний запуск QStash"]}
      minWidth={980}
    >
      <tbody>
        {status.schedules.map((schedule) => <tr key={schedule.id}>
          <th scope="row">
            <span className="scheduler-schedule-name">{schedule.label}</span>
            <span className="scheduler-schedule-id">{schedule.id}</span>
          </th>
          <td><code className="scheduler-cron">{schedule.cron}</code></td>
          <td><span className={`management-status scheduler-status is-${schedule.state}`}>{stateLabel[schedule.state]}</span></td>
          <td className="scheduler-timestamp">{formatTimestamp(schedule.lastScheduledAt)}</td>
          <td className="scheduler-timestamp">{schedule.nextScheduledAt ? formatTimestamp(schedule.nextScheduledAt) : "Немає даних"}</td>
        </tr>)}
      </tbody>
    </ManagementTable>

    <form action={action} className="page-actions scheduler-actions">
      <button
        className="button button-primary"
        disabled={pending || hasConfigurationProblem}
        aria-describedby={hasConfigurationProblem ? messageId : undefined}
      >
        <RefreshCw size={16} aria-hidden="true" className={pending ? "is-spinning" : undefined} />
        {pending ? "Оновлення cron…" : "Ініціалізувати / оновити cron"}
      </button>
      <p className="scheduler-action-copy">Дія безпечно перезаписує тільки два службові schedules зі сталими ID.</p>
    </form>

    {actionState.message ? <p className={`period-action-message ${actionState.success ? "is-success" : "is-error"}`}
      role={actionState.success ? "status" : "alert"}>{actionState.message}</p> : null}
  </div>;
}
