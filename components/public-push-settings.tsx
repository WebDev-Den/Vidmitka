"use client";

import { useEffect, useId, useState, type FormEvent } from "react";

import { ensureServiceWorker } from "@/lib/pwa/service-worker";
import type { PublicTeacher } from "@/lib/schedule-v2/public-schedule";

import styles from "./public-push-settings.module.css";

type BrowserPermission = NotificationPermission | "checking" | "unsupported";
type Feedback = Readonly<{ kind: "success" | "error" | "info"; message: string }>;
type PushPreferences = Readonly<{
  teacherId: string;
  morningEnabled: boolean;
  morningTime: string;
  lessonReminderEnabled: boolean;
  lessonLeadMinutes: number;
}>;

type PushStatusPayload = Readonly<{
  data?: Readonly<{ settings?: unknown }>;
}>;

type PushConfigurationPayload = Readonly<{
  data?: Readonly<{ vapidPublicKey?: unknown }>;
}>;

type PushProblemPayload = Readonly<{
  error?: Readonly<{ message?: unknown }>;
}>;

class PushTestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "PushTestError";
  }
}

function supportsPush(): boolean {
  return typeof window !== "undefined"
    && "Notification" in window
    && "PushManager" in window
    && "serviceWorker" in navigator;
}

function currentPermission(): BrowserPermission {
  if (!supportsPush()) return "unsupported";
  return Notification.permission;
}

function isIosDevice(): boolean {
  return /iPad|iPhone|iPod/u.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isValidTime(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{2}:\d{2}$/u.test(value)) return false;
  return value >= "07:00" && value <= "20:00";
}

function isPushPreferences(value: unknown): value is PushPreferences {
  if (!value || typeof value !== "object") return false;
  const settings = value as Partial<PushPreferences>;
  const lessonLeadMinutes = settings.lessonLeadMinutes;
  return typeof settings.teacherId === "string"
    && typeof settings.morningEnabled === "boolean"
    && isValidTime(settings.morningTime)
    && typeof settings.lessonReminderEnabled === "boolean"
    && typeof lessonLeadMinutes === "number"
    && Number.isInteger(lessonLeadMinutes)
    && lessonLeadMinutes >= 1
    && lessonLeadMinutes <= 60;
}

function subscriptionPayload(subscription: PushSubscription): PushSubscriptionJSON {
  return subscription.toJSON();
}

function vapidKeyBytes(value: string): Uint8Array {
  const normalized = value.trim().replace(/-/gu, "+").replace(/_/gu, "/");
  const padded = `${normalized}${"=".repeat((4 - (normalized.length % 4)) % 4)}`;
  const binary = window.atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function getPushConfiguration(): Promise<string | null> {
  const response = await fetch("/api/public/push", { headers: { Accept: "application/json" } });
  const payload = await response.json().catch(() => null) as PushConfigurationPayload | null;
  if (!response.ok || !payload?.data || !("vapidPublicKey" in payload.data)) {
    throw new Error("PUSH_CONFIGURATION_UNAVAILABLE");
  }
  return typeof payload.data.vapidPublicKey === "string" && payload.data.vapidPublicKey.trim()
    ? payload.data.vapidPublicKey
    : null;
}

async function getStoredPreferences(subscription: PushSubscription): Promise<PushPreferences | null> {
  const response = await fetch("/api/public/push", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ action: "status", subscription: subscriptionPayload(subscription) }),
  });
  const payload = await response.json().catch(() => null) as PushStatusPayload | null;
  if (!response.ok || !payload?.data) throw new Error("PUSH_STATUS_UNAVAILABLE");
  return isPushPreferences(payload.data.settings) ? payload.data.settings : null;
}

async function savePreferences(subscription: PushSubscription, preferences: PushPreferences): Promise<void> {
  const response = await fetch("/api/public/push", {
    method: "PUT",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ subscription: subscriptionPayload(subscription), preferences }),
  });
  if (!response.ok) throw new Error("PUSH_SAVE_UNAVAILABLE");
}

async function deletePreferences(subscription: PushSubscription): Promise<void> {
  const response = await fetch("/api/public/push", {
    method: "DELETE",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ subscription: subscriptionPayload(subscription) }),
  });
  if (!response.ok) throw new Error("PUSH_DELETE_UNAVAILABLE");
}

async function sendTestPush(subscription: PushSubscription): Promise<void> {
  const response = await fetch("/api/public/push", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ action: "test", subscription: subscriptionPayload(subscription) }),
  });
  if (response.ok) return;

  const payload = await response.json().catch(() => null) as PushProblemPayload | null;
  const message = typeof payload?.error?.message === "string"
    ? payload.error.message
    : "Не вдалося надіслати тестове сповіщення. Спробуйте пізніше.";
  throw new PushTestError(response.status, message);
}

function permissionDescription(permission: BrowserPermission, hasSubscription: boolean): string {
  if (permission === "checking") return "Перевіряємо підтримку браузера…";
  if (permission === "unsupported") return "У цьому браузері Web Push недоступний.";
  if (permission === "denied") return "Сповіщення заблоковано в налаштуваннях браузера.";
  if (permission === "default") return "Дозвіл буде запитано лише після натискання кнопки нижче.";
  return hasSubscription ? "Дозвіл надано, цей пристрій підписано." : "Дозвіл надано, але пристрій ще не підписано.";
}

function pushFailureMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message === "SERVICE_WORKER_READY_TIMEOUT") {
    return "Не вдалося активувати службу сповіщень. Перезавантажте сторінку та спробуйте ще раз.";
  }
  if (error instanceof Error && error.message === "STALE_SUBSCRIPTION_UNSUBSCRIBE_FAILED") {
    return "Не вдалося оновити застарілу підписку браузера. Перезавантажте сторінку та спробуйте ще раз.";
  }
  return fallback;
}

export function PublicPushSettings({
  teachers,
  onTeacherSaved,
}: {
  teachers: readonly PublicTeacher[];
  onTeacherSaved?: (teacherId: string) => void;
}) {
  const headingId = useId();
  const [teacherId, setTeacherId] = useState("");
  const [morningEnabled, setMorningEnabled] = useState(false);
  const [morningTime, setMorningTime] = useState("08:00");
  const [lessonReminderEnabled, setLessonReminderEnabled] = useState(false);
  const [lessonLeadMinutes, setLessonLeadMinutes] = useState(15);
  const [permission, setPermission] = useState<BrowserPermission>("checking");
  const [hasSubscription, setHasSubscription] = useState(false);
  const [hasStoredSettings, setHasStoredSettings] = useState(false);
  const [needsResubscribe, setNeedsResubscribe] = useState(false);
  const [vapidPublicKey, setVapidPublicKey] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isDisabling, setIsDisabling] = useState(false);
  const [ios, setIos] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const browserPermission = currentPermission();
      if (cancelled) return;
      setPermission(browserPermission);
      setIos(browserPermission !== "unsupported" && isIosDevice());

      if (browserPermission === "unsupported") {
        setIsChecking(false);
        return;
      }

      try {
        const [configuration, registration] = await Promise.all([
          getPushConfiguration(),
          ensureServiceWorker(),
        ]);
        const subscription = await registration.pushManager.getSubscription();
        const stored = subscription ? await getStoredPreferences(subscription) : null;
        if (cancelled) return;

        setVapidPublicKey(configuration);
        setHasSubscription(subscription !== null);
        setHasStoredSettings(stored !== null);
        if (stored) {
          if (teachers.some((teacher) => teacher.id === stored.teacherId)) {
            setTeacherId(stored.teacherId);
          }
          setMorningEnabled(stored.morningEnabled);
          setMorningTime(stored.morningTime);
          setLessonReminderEnabled(stored.lessonReminderEnabled);
          setLessonLeadMinutes(stored.lessonLeadMinutes);
        }
      } catch (error) {
        if (!cancelled) {
          setFeedback({
            kind: "info",
            message: pushFailureMessage(
              error,
              "Не вдалося перевірити збережені налаштування. Їх можна спробувати зберегти повторно.",
            ),
          });
        }
      } finally {
        if (!cancelled) setIsChecking(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [teachers]);

  const canSave = Boolean(teacherId)
    && (morningEnabled || lessonReminderEnabled)
    && vapidPublicKey !== null
    && !isChecking
    && !isSaving
    && !isTesting
    && !isDisabling
    && permission !== "unsupported";

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);

    if (!teacherId) {
      setFeedback({ kind: "error", message: "Оберіть викладача для цього пристрою." });
      return;
    }
    if (!morningEnabled && !lessonReminderEnabled) {
      setFeedback({ kind: "error", message: "Оберіть щонайменше один тип сповіщень." });
      return;
    }
    if (!supportsPush()) {
      setPermission("unsupported");
      setFeedback({ kind: "error", message: "У цьому браузері Web Push недоступний." });
      return;
    }

    // Permission is deliberately the first awaited browser operation in the user gesture.
    let grantedPermission = Notification.permission;
    if (grantedPermission === "default") {
      grantedPermission = await Notification.requestPermission();
      setPermission(grantedPermission);
    }
    if (grantedPermission !== "granted") {
      setFeedback({
        kind: "error",
        message: grantedPermission === "denied"
          ? "Браузер заблокував сповіщення. Дозвольте їх у налаштуваннях сайту та спробуйте ще раз."
          : "Дозвіл на сповіщення не надано.",
      });
      return;
    }

    setIsSaving(true);
    try {
      const [configuration, registration] = await Promise.all([
        vapidPublicKey === null ? getPushConfiguration() : Promise.resolve(vapidPublicKey),
        ensureServiceWorker(),
      ]);
      if (!configuration) throw new Error("VAPID_PUBLIC_KEY_UNAVAILABLE");

      let subscription = await registration.pushManager.getSubscription();
      if (needsResubscribe && subscription) {
        const unsubscribed = await subscription.unsubscribe();
        if (!unsubscribed) throw new Error("STALE_SUBSCRIPTION_UNSUBSCRIBE_FAILED");
        subscription = null;
      }
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidKeyBytes(configuration),
        });
      }

      const preferences: PushPreferences = {
        teacherId,
        morningEnabled,
        morningTime,
        lessonReminderEnabled,
        lessonLeadMinutes,
      };
      await savePreferences(subscription, preferences);
      setVapidPublicKey(configuration);
      setHasSubscription(true);
      setHasStoredSettings(true);
      setNeedsResubscribe(false);
      setFeedback({ kind: "success", message: "Налаштування сповіщень збережено для цього пристрою." });
      onTeacherSaved?.(teacherId);
    } catch (error) {
      setFeedback({
        kind: "error",
        message: pushFailureMessage(error, "Не вдалося зберегти сповіщення. Перевірте з’єднання та спробуйте ще раз."),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    if (!supportsPush()) return;
    setFeedback(null);
    setIsTesting(true);
    try {
      const registration = await ensureServiceWorker();
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        setHasSubscription(false);
        setHasStoredSettings(false);
        setFeedback({
          kind: "error",
          message: "Спочатку увімкніть і збережіть сповіщення для цього пристрою.",
        });
        return;
      }

      await sendTestPush(subscription);
      setFeedback({
        kind: "success",
        message: "Тест надіслано. Він може з’явитися за кілька секунд.",
      });
    } catch (error) {
      if (error instanceof PushTestError && error.status === 410) {
        try {
          const registration = await ensureServiceWorker();
          const subscription = await registration.pushManager.getSubscription();
          await subscription?.unsubscribe();
        } catch {
          // The server record is already revoked; local browser cleanup is best effort.
        }
        setHasSubscription(false);
        setHasStoredSettings(false);
        setNeedsResubscribe(true);
      }
      if (error instanceof PushTestError && error.status === 409) {
        setHasStoredSettings(false);
      }
      setFeedback({
        kind: "error",
        message: error instanceof PushTestError
          ? error.message
          : pushFailureMessage(error, "Не вдалося надіслати тестове сповіщення. Спробуйте пізніше."),
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleDisable = async () => {
    if (!supportsPush()) return;
    setFeedback(null);
    setIsDisabling(true);
    try {
      const registration = await ensureServiceWorker();
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await deletePreferences(subscription);
        await subscription.unsubscribe();
      }
      setHasSubscription(false);
      setHasStoredSettings(false);
      setNeedsResubscribe(false);
      setMorningEnabled(false);
      setLessonReminderEnabled(false);
      setFeedback({ kind: "success", message: "Сповіщення для цього пристрою вимкнено." });
    } catch (error) {
      setFeedback({
        kind: "error",
        message: pushFailureMessage(error, "Не вдалося вимкнути сповіщення. Спробуйте ще раз."),
      });
    } finally {
      setIsDisabling(false);
    }
  };

  return <section className={styles.settings} aria-labelledby={headingId}>
    <header className={styles.header}>
      <div>
        <h2 id={headingId}>Сповіщення</h2>
        <p>Налаштування діють лише для цього пристрою.</p>
      </div>
      <span className={styles.permissionBadge} data-state={permission}>
        {permission === "granted"
          ? "Дозволено"
          : permission === "denied"
            ? "Заблоковано"
            : permission === "unsupported"
              ? "Недоступно"
              : permission === "checking"
                ? "Перевіряємо"
                : "Потрібен дозвіл"}
      </span>
    </header>

    <p className={styles.permissionDescription} data-state={permission}>
      <strong>Дозвіл браузера</strong>
      <span>{permissionDescription(permission, hasSubscription)}</span>
    </p>

    {!isChecking && vapidPublicKey === null ? <p className={styles.configurationHint}>
      Сповіщення ще не налаштовані на сервері. Спробуйте пізніше.
    </p> : null}

    {ios ? <p className={styles.iosHint}>
      На iPhone/iPad спочатку встановіть «Відмітку» на початковий екран, а потім дозвольте сповіщення.
    </p> : null}

    <form className={styles.form} onSubmit={handleSave} aria-busy={isChecking || isSaving || isTesting || isDisabling}>
      <label className={styles.field}>
        <span>Викладач</span>
        <select
          value={teacherId}
          onChange={(event) => setTeacherId(event.target.value)}
          disabled={isChecking || isSaving || isTesting || isDisabling || teachers.length === 0}
          name="teacherId"
          autoComplete="off"
          required
        >
          <option value="" disabled>Оберіть викладача</option>
          {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}
        </select>
      </label>
      {!teachers.length ? <p className={styles.empty}>Активних викладачів поки немає.</p> : null}

      <fieldset className={styles.eventSettings}>
        <legend>Події</legend>
        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={morningEnabled}
            onChange={(event) => setMorningEnabled(event.target.checked)}
            disabled={isChecking || isSaving || isTesting || isDisabling}
          />
          <span><strong>Щоденний розклад</strong><small>Надішлемо список сьогоднішніх пар або «Сьогодні занять немає 🙂».</small></span>
        </label>
        <label className={`${styles.field} ${styles.dependentField}`}>
          <span>Час надсилання</span>
          <input
            type="time"
            value={morningTime}
            name="morningTime"
            min="07:00"
            max="20:00"
            step="60"
            onChange={(event) => setMorningTime(event.target.value)}
            disabled={!morningEnabled || isChecking || isSaving || isTesting || isDisabling}
            required={morningEnabled}
          />
          <small>З 07:00 до 20:00 за київським часом.</small>
        </label>

        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={lessonReminderEnabled}
            onChange={(event) => setLessonReminderEnabled(event.target.checked)}
            disabled={isChecking || isSaving || isTesting || isDisabling}
          />
          <span><strong>Нагадування перед парою</strong><small>Номер, час, аудиторія та групи.</small></span>
        </label>
        <label className={`${styles.field} ${styles.dependentField}`}>
          <span>За скільки хвилин</span>
          <input
            type="number"
            inputMode="numeric"
            value={lessonLeadMinutes}
            name="lessonLeadMinutes"
            min={1}
            max={60}
            step={1}
            onChange={(event) => {
              const value = Number(event.target.value);
              setLessonLeadMinutes(Number.isFinite(value) ? Math.min(60, Math.max(1, Math.trunc(value))) : 15);
            }}
            disabled={!lessonReminderEnabled || isChecking || isSaving || isTesting || isDisabling}
            required={lessonReminderEnabled}
          />
          <small>Від 1 до 60 хвилин; за замовчуванням — 15.</small>
        </label>
      </fieldset>

      <p className={styles.selectionHint}>
        {morningEnabled || lessonReminderEnabled ? "" : "Оберіть щонайменше один тип сповіщень."}
      </p>

      <div className={styles.actions}>
        <button className={styles.saveButton} type="submit" disabled={!canSave}>
          {isSaving ? "Збереження…" : hasSubscription ? "Зберегти налаштування" : "Увімкнути та зберегти"}
        </button>
        <button
          className={styles.testButton}
          type="button"
          disabled={
            !hasSubscription
            || !hasStoredSettings
            || vapidPublicKey === null
            || permission !== "granted"
            || isChecking
            || isSaving
            || isTesting
            || isDisabling
          }
          onClick={() => void handleTest()}
        >
          {isTesting ? "Надсилання…" : "Надіслати тест"}
        </button>
        <button
          className={styles.disableButton}
          type="button"
          disabled={!hasSubscription || isChecking || isSaving || isTesting || isDisabling}
          onClick={() => void handleDisable()}
        >
          {isDisabling ? "Вимкнення…" : "Вимкнути сповіщення"}
        </button>
      </div>
    </form>

    {feedback ? <p
      className={styles.feedback}
      data-kind={feedback.kind}
      role={feedback.kind === "error" ? "alert" : "status"}
      aria-live={feedback.kind === "error" ? "assertive" : "polite"}
    >{feedback.message}</p> : null}
  </section>;
}
