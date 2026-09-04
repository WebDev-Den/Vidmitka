"use client";

import { Popover } from "@base-ui/react/popover";
import { RotateCcw, X } from "lucide-react";
import { useEffect, useState } from "react";

import type { PublicPeriod } from "@/lib/schedule-v2/public-schedule";

import styles from "./free-room-popover.module.css";

type FreeRoom = Readonly<{ id: string; name: string }>;
type FreeRoomResult = Readonly<{
  date: string;
  periodNumber: number;
  rooms: readonly FreeRoom[];
  availableCount: number;
  totalCount: number;
}>;
type LoadState =
  | Readonly<{ status: "loading" }>
  | Readonly<{ status: "success"; result: FreeRoomResult }>
  | Readonly<{ status: "error"; message: string }>;

function compactDateLabel(date: string): string {
  return new Intl.DateTimeFormat("uk-UA", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

function isFreeRoomResult(value: unknown): value is FreeRoomResult {
  if (!value || typeof value !== "object") return false;
  const result = value as Partial<FreeRoomResult>;
  return typeof result.date === "string"
    && Number.isInteger(result.periodNumber)
    && Array.isArray(result.rooms)
    && result.rooms.every((room) => room && typeof room.id === "string" && typeof room.name === "string")
    && Number.isInteger(result.availableCount)
    && Number.isInteger(result.totalCount);
}

export function FreeRoomPopover({ date, period }: {
  date: string;
  period: PublicPeriod;
}) {
  const [open, setOpen] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    if (!open) return;

    const controller = new AbortController();
    setLoadState({ status: "loading" });

    void fetch(`/api/public/free-rooms?date=${encodeURIComponent(date)}&periodNumber=${period.number}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    }).then(async (response) => {
      const payload = await response.json() as {
        data?: unknown;
        error?: { message?: unknown };
      };
      if (!response.ok || !isFreeRoomResult(payload.data)) {
        throw new Error(typeof payload.error?.message === "string"
          ? payload.error.message
          : "Не вдалося завантажити вільні аудиторії.");
      }
      setLoadState({ status: "success", result: payload.data });
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      setLoadState({
        status: "error",
        message: error instanceof Error ? error.message : "Не вдалося завантажити вільні аудиторії.",
      });
    });

    return () => controller.abort();
  }, [date, open, period.number, retryKey]);

  return <Popover.Root open={open} onOpenChange={setOpen} modal="trap-focus">
    <Popover.Trigger
      className={styles.trigger}
      type="button"
      aria-label={`Показати вільні аудиторії для ${period.number} пари`}
      title="Показати вільні аудиторії"
    >
      <span className={styles.number}>{period.number}</span>
    </Popover.Trigger>
    <Popover.Portal>
      <Popover.Positioner className={styles.positioner} side="right" align="center" sideOffset={8} collisionPadding={10}>
        <Popover.Popup className={styles.popup} initialFocus finalFocus>
          <div className={styles.header}>
            <div>
              <Popover.Title className={styles.title}>Вільні аудиторії</Popover.Title>
              <Popover.Description className={styles.description}>
                {period.number} пара · {period.startTime}–{period.endTime} · {compactDateLabel(date)}
              </Popover.Description>
            </div>
            <Popover.Close className={styles.close} aria-label="Закрити список вільних аудиторій">
              <X aria-hidden="true" />
            </Popover.Close>
          </div>

          <div className={styles.content} aria-live="polite" aria-busy={loadState.status === "loading"}>
            {loadState.status === "loading" ? <div className={styles.message} role="status">
              <span className={styles.spinner} aria-hidden="true" />
              Перевіряємо аудиторії…
            </div> : null}

            {loadState.status === "error" ? <div className={styles.error} role="alert">
              <span>{loadState.message}</span>
              <button type="button" onClick={() => setRetryKey((value) => value + 1)}>
                <RotateCcw aria-hidden="true" /> Повторити
              </button>
            </div> : null}

            {loadState.status === "success" ? <>
              <p className={styles.summary}>
                Вільно <strong>{loadState.result.availableCount}</strong> із {loadState.result.totalCount}
              </p>
              {loadState.result.rooms.length ? <ul className={styles.roomList} aria-label="Список вільних аудиторій">
                {loadState.result.rooms.map((room) => <li key={room.id}>{room.name}</li>)}
              </ul> : <p className={styles.empty}>
                {loadState.result.totalCount
                  ? "На цю пару вільних аудиторій немає."
                  : "Адміністратор ще не додав активних аудиторій."}
              </p>}
            </> : null}
          </div>
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  </Popover.Root>;
}
