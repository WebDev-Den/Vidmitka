"use client";

import { LoaderCircle, Play, Radio } from "lucide-react";
import { useActionState, type ReactNode } from "react";

import { ManagementTable } from "@/components/private/management-table";
import type { AdminPushDashboard, AdminPushManualDelivery, AdminPushScanRun, AdminPushSubscription } from "@/lib/public-push/admin-types";

import type { AdminPushActionState } from "@/app/admin/(protected)/push/form-state";
import { initialAdminPushActionState } from "@/app/admin/(protected)/push/form-state";

import styles from "./push-operations-manager.module.css";

const kyivDateTime = new Intl.DateTimeFormat("uk-UA", {
  timeZone: "Europe/Kyiv",
  dateStyle: "short",
  timeStyle: "short",
});

function formatKyiv(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? kyivDateTime.format(date) : "—";
}

function eventDescription(subscription: AdminPushSubscription): ReactNode {
  const values = [
    subscription.morningTime ? <span key="morning"><strong>Розклад</strong> о {subscription.morningTime}</span> : null,
    subscription.lessonLeadMinutes !== null
      ? <span key="lesson"><strong>Нагадування</strong> за {subscription.lessonLeadMinutes} хв</span>
      : null,
  ].filter(Boolean);
  return <div className={styles.events}>{values}</div>;
}

function scanStatus(run: AdminPushScanRun): string {
  if (run.status === "completed") return "Завершено";
  if (run.status === "ignored") return "Поза вікном";
  return "Помилка";
}

function scanDetails(run: AdminPushScanRun): string {
  if (run.failureCode === "web_push_unavailable") return "Push-конфігурація недоступна";
  if (run.failureCode === "scanner_unavailable") return "Scanner тимчасово недоступний";
  if (run.failureCode === "schedule_error") return "Помилка читання розкладу";
  return "—";
}

function manualKind(delivery: AdminPushManualDelivery): string {
  return delivery.kind === "daily_digest" ? "Щоденний розклад" : "Нагадування перед парою";
}

function manualStatus(delivery: AdminPushManualDelivery): string {
  if (delivery.status === "sent") return "Надіслано";
  if (delivery.status === "invalid") return "Підписка недійсна";
  if (delivery.status === "failed") return "Не доставлено";
  return "Надсилання";
}

function SubscriptionRow({ subscription, action, disabled }: {
  subscription: AdminPushSubscription;
  action: (previous: AdminPushActionState, formData: FormData) => Promise<AdminPushActionState>;
  disabled: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, initialAdminPushActionState);
  const label = `Надіслати найближче заплановане повідомлення для ${subscription.teacherName}`;
  return <tr>
    <th scope="row">{subscription.teacherName}</th>
    <td>{eventDescription(subscription)}</td>
    <td className={styles.statusCell}>{formatKyiv(subscription.lastSeenAt)}</td>
    <td>
      <form action={formAction} className={styles.playForm} aria-busy={pending}>
        <input type="hidden" name="subscriptionId" value={subscription.id} />
        <button className={`button button-primary ${styles.playButton}`} type="submit" disabled={pending || disabled} aria-label={label}>
          {pending ? <LoaderCircle size={16} className={styles.spinner} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
          {pending ? "Надсилання…" : "Надіслати"}
        </button>
        {state.message ? <p className={`${styles.rowFeedback} ${state.success ? styles.isSuccess : styles.isError}`}
          role={state.success ? "status" : "alert"}>{state.message}</p> : null}
      </form>
    </td>
  </tr>;
}

export function PushOperationsManager({ dashboard, action }: {
  dashboard: AdminPushDashboard;
  action: (previous: AdminPushActionState, formData: FormData) => Promise<AdminPushActionState>;
}) {
  if (!dashboard.ready) {
    return <div className={styles.stack}>
      <p className={`${styles.status} ${styles.statusError}`} role="alert">
        Журнал Push ще не підготовлено. Потрібна міграція `017_public_push_admin_operations.sql`.
      </p>
    </div>;
  }

  return <div className={styles.stack}>
    <p className={`${styles.status}${dashboard.webPushConfigured ? "" : ` ${styles.statusError}`}`} role="status">
      <Radio size={17} aria-hidden="true" />
      {dashboard.webPushConfigured
        ? "Push-конфігурація активна. Play надсилає найближче заплановане повідомлення вибраному пристрою."
        : "Push-конфігурація сервера недоступна: перегляд журналу працює, ручне надсилання вимкнено."}
    </p>

    <section className={styles.section} aria-labelledby="push-subscriptions-heading">
      <div className={styles.heading}>
        <h2 id="push-subscriptions-heading">Активні підписки</h2>
        <p>Пристрій не ідентифікується в UI: показано лише викладача та обрані події.</p>
      </div>
      <ManagementTable caption="Активні Push-підписки" columns={["Викладач", "Події", "Остання активність", "Ручний запуск"]} minWidth={900}>
        <tbody>
          {dashboard.subscriptions.map((subscription) => <SubscriptionRow key={subscription.id} subscription={subscription} action={action} disabled={!dashboard.webPushConfigured} />)}
          {!dashboard.subscriptions.length ? <tr><td colSpan={4} className={styles.muted}>Активних підписок ще немає.</td></tr> : null}
        </tbody>
      </ManagementTable>
    </section>

    <section className={styles.section} aria-labelledby="push-scans-heading">
      <div className={styles.heading}>
        <h2 id="push-scans-heading">Останні cron-запуски</h2>
        <p>Кожен автентичний QStash виклик scanner-а; «поза вікном» не означає помилку.</p>
      </div>
      <ManagementTable caption="Останні cron-запуски Push" columns={["Час (Київ)", "Стан", "Пристрої", "Надіслано", "Помилки", "Деталі"]} minWidth={980}>
        <tbody>
          {dashboard.scanRuns.map((run) => <tr key={run.id}>
            <th scope="row" className={styles.statusCell}>{formatKyiv(run.createdAt)}</th>
            <td>{scanStatus(run)}</td>
            <td>{run.subscriptions}</td>
            <td>{run.sent}</td>
            <td>{run.failed + run.invalid + run.scheduleErrors}</td>
            <td>{scanDetails(run)}</td>
          </tr>)}
          {!dashboard.scanRuns.length ? <tr><td colSpan={6} className={styles.muted}>Cron ще не виконувався або записів немає.</td></tr> : null}
        </tbody>
      </ManagementTable>
    </section>

    <section className={styles.section} aria-labelledby="push-manual-heading">
      <div className={styles.heading}>
        <h2 id="push-manual-heading">Ручні доставки</h2>
        <p>Вони записуються окремо та не впливають на автоматичні сповіщення.</p>
      </div>
      <ManagementTable caption="Ручні доставки Push" columns={["Час (Київ)", "Викладач", "Подія", "Плановий час", "Результат"]} minWidth={880}>
        <tbody>
          {dashboard.manualDeliveries.map((delivery) => <tr key={delivery.id}>
            <th scope="row" className={styles.statusCell}>{formatKyiv(delivery.createdAt)}</th>
            <td>{delivery.teacherName}</td>
            <td>{manualKind(delivery)}</td>
            <td className={styles.statusCell}>{delivery.scheduledDate.split("-").reverse().join(".")} · {delivery.scheduledTime}</td>
            <td>{manualStatus(delivery)}{delivery.providerStatus ? ` (${delivery.providerStatus})` : ""}</td>
          </tr>)}
          {!dashboard.manualDeliveries.length ? <tr><td colSpan={5} className={styles.muted}>Ручних запусків ще не було.</td></tr> : null}
        </tbody>
      </ManagementTable>
    </section>
  </div>;
}
