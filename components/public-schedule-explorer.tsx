"use client";

import { Combobox } from "@base-ui/react/combobox";
import { Dialog } from "@base-ui/react/dialog";
import { Popover } from "@base-ui/react/popover";
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Search, Settings, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { FreeRoomPopover } from "@/components/free-room-popover";
import { PwaControls } from "@/components/pwa-controls";
import { PublicPushSettings } from "@/components/public-push-settings";
import { PublicHeader } from "@/components/public-header";
import { periodColorForeground } from "@/lib/class-periods/colors";
import { calendarDayLabel } from "@/lib/schedule-v2/calendar-override-rules";
import type {
  PublicPeriod,
  PublicScheduleDay,
  PublicScheduleItem,
  PublicTeacher,
} from "@/lib/schedule-v2/public-schedule";
import {
  addPublicScheduleDays,
  isPublicDateKey,
  PUBLIC_DATE_HANDOFF_STORAGE,
  publicNavigationWeek,
  publicScheduleRequestUrl,
  publicScheduleScrollTarget,
  PUBLIC_TEACHER_COOKIE,
} from "@/lib/schedule-v2/public-schedule-state";

import styles from "./public-schedule-explorer.module.css";

const CHANGE_LABELS: Record<string, string> = {
  move: "Перенесено",
  reschedule: "Змінено час",
  room_change: "Змінено аудиторію",
  teacher_change: "Заміна викладача",
  discipline_change: "Заміна дисципліни",
  type_change: "Змінено тип",
  cancel: "Скасовано",
  one_time: "Разове заняття",
  calendar_override: "Перенесення дня",
};

type TeacherOption = Readonly<{ value: string; label: string }>;
type ScheduleSelection = Readonly<{ date: string; teacherId: string }>;
type LoadFailure = Readonly<{
  message: string;
  selection: ScheduleSelection;
  persistTeacher: boolean;
}>;

function PendingControlStatus({ pending, label }: { pending: boolean; label: string }) {
  return <>
    {pending ? <span className={styles.pendingOverlay} aria-hidden="true"><span className={styles.pendingSpinner} /></span> : null}
    <span className="sr-only" role="status" aria-atomic="true">{pending ? `Завантаження: ${label}…` : ""}</span>
  </>;
}

function persistTeacherPreference(teacherId: string): void {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  const maxAge = teacherId ? 31_536_000 : 0;
  try {
    document.cookie = `${PUBLIC_TEACHER_COOKIE}=${teacherId}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
  } catch {
    // The selected schedule still works for this session when cookies are blocked.
  }
}

function dateLabel(date: string): string {
  return new Intl.DateTimeFormat("uk-UA", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

function compactMobileDateLabel(date: string, todayDate: string): string {
  if (date === todayDate) return "Сьогодні";
  return new Intl.DateTimeFormat("uk-UA", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`)).replace(".", "");
}

function kyivClock(now: Date | null): { time: string; date: string; dateKey: string; minutes: number } {
  if (!now) return { time: "--:--", date: "Завантаження дати", dateKey: "", minutes: -1 };
  const dateKey = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Europe/Kyiv",
  }).format(now);
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Kyiv",
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0) % 24;
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return {
    time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    date: new Intl.DateTimeFormat("uk-UA", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      timeZone: "Europe/Kyiv",
    }).format(now),
    dateKey,
    minutes: hour * 60 + minute,
  };
}

function toMinutes(value: string): number {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function periodStatus(period: PublicPeriod, dayDate: string, clock: ReturnType<typeof kyivClock>) {
  if (!clock.dateKey || dayDate !== clock.dateKey) return "neutral";
  const start = toMinutes(period.startTime);
  const end = toMinutes(period.endTime);
  if (clock.minutes >= start && clock.minutes <= end) return "current";
  return clock.minutes > end ? "past" : "upcoming";
}

type LiveDayStatus = Readonly<{
  kind: "current" | "break" | "upcoming" | "finished";
  title: string;
  detail: string;
}>;

function durationLabel(minutes: number): string {
  const totalMinutes = Math.max(0, Math.ceil(minutes));
  if (totalMinutes === 0) return "менше хвилини";
  const hours = Math.floor(totalMinutes / 60);
  const remainder = totalMinutes % 60;
  return [hours ? `${hours} год` : "", remainder ? `${remainder} хв` : ""].filter(Boolean).join(" ");
}

function liveDayStatus(dayDate: string, periods: readonly PublicPeriod[], clock: ReturnType<typeof kyivClock>): LiveDayStatus | null {
  if (!clock.dateKey || dayDate !== clock.dateKey || !periods.length) return null;
  const timeline = [...periods].sort((left, right) => toMinutes(left.startTime) - toMinutes(right.startTime));
  const current = timeline.find((period) => {
    const start = toMinutes(period.startTime);
    const end = toMinutes(period.endTime);
    return clock.minutes >= start && clock.minutes <= end;
  });
  if (current) {
    return {
      kind: "current",
      title: `Зараз ${current.number} пара`,
      detail: `ще ${durationLabel(toMinutes(current.endTime) - clock.minutes)}`,
    };
  }

  const next = timeline.find((period) => toMinutes(period.startTime) > clock.minutes);
  if (!next) {
    return { kind: "finished", title: "Заняття на сьогодні завершені", detail: "Усі пари вже минули" };
  }

  const untilNext = durationLabel(toMinutes(next.startTime) - clock.minutes);
  const hasFinishedPeriod = timeline.some((period) => toMinutes(period.endTime) < clock.minutes);
  if (hasFinishedPeriod) {
    return { kind: "break", title: "Перерва", detail: `Наступна ${next.number} пара через ${untilNext}` };
  }
  return { kind: "upcoming", title: "Заняття ще не почались", detail: `До ${next.number} пари ${untilNext}` };
}

function LessonCard({ item }: { item: PublicScheduleItem }) {
  return <article
    className={`${styles.lessonCard} ${item.cancelled ? styles.cancelled : ""}`}
    style={{ "--lesson-color": item.lessonTypeColor } as CSSProperties}
  >
    <div className={styles.lessonTop}>
      <span className={styles.lessonType}>{item.lessonType}</span>
      <span className={styles.lessonRoom}>{item.rooms.join(", ") || "Без аудиторії"}</span>
    </div>
    <strong className={styles.lessonSubject}>{item.discipline}</strong>
    <span className={styles.lessonTeacher}>{item.teachers.join(", ") || "Викладача не вказано"}</span>
    {item.changeKind ? <span className={styles.changeBadge}>{CHANGE_LABELS[item.changeKind] ?? "Змінено"}</span> : null}
    {item.changeReason || item.note ? <small className={styles.lessonNote}>{item.changeReason || item.note}</small> : null}
    {item.groups.length ? <div className={styles.lessonGroups} aria-label="Навчальні групи заняття">
      <span>Групи</span>
      <strong>{item.groups.join(", ")}</strong>
    </div> : null}
  </article>;
}

function DaySchedule({ day, periods, clock }: {
  day: PublicScheduleDay;
  periods: readonly PublicPeriod[];
  clock: ReturnType<typeof kyivClock>;
}) {
  const periodGridRef = useRef<HTMLDivElement | null>(null);
  const scrollTargetRef = useRef<HTMLDivElement | null>(null);
  const didAutoScroll = useRef(false);
  const [showReturnToCurrent, setShowReturnToCurrent] = useState(false);
  const byPeriod = useMemo(() => {
    const result = new Map<number, PublicScheduleItem[]>();
    for (const item of day.items) {
      const values = result.get(item.periodNumber) ?? [];
      values.push(item);
      result.set(item.periodNumber, values);
    }
    return result;
  }, [day.items]);
  const scrollTargetPeriod = publicScheduleScrollTarget({
    periods,
    date: day.date,
    currentDate: clock.dateKey,
    currentMinutes: clock.minutes,
  });
  const liveStatus = liveDayStatus(day.date, periods, clock);

  const updateReturnToCurrentVisibility = useCallback(() => {
    const grid = periodGridRef.current;
    const target = scrollTargetRef.current;
    if (!grid || !target || scrollTargetPeriod === null) {
      setShowReturnToCurrent(false);
      return;
    }

    const gridRect = grid.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const gridOwnsScroll = grid.scrollHeight > grid.clientHeight + 1;
    const visibleTop = gridOwnsScroll ? gridRect.top : 0;
    const visibleBottom = gridOwnsScroll ? gridRect.bottom : window.innerHeight;
    const shouldShow = targetRect.bottom <= visibleTop + 12 || targetRect.top >= visibleBottom - 12;
    setShowReturnToCurrent((current) => current === shouldShow ? current : shouldShow);
  }, [scrollTargetPeriod]);

  const scrollToCurrentPeriod = useCallback(() => {
    const grid = periodGridRef.current;
    const target = scrollTargetRef.current;
    if (!grid || !target) return;

    if (grid.scrollHeight > grid.clientHeight + 1) {
      const gridRect = grid.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const targetTop = grid.scrollTop + targetRect.top - gridRect.top;
      const centeredTop = targetTop - (grid.clientHeight - targetRect.height) / 2;
      const maxScrollTop = Math.max(0, grid.scrollHeight - grid.clientHeight);
      grid.scrollTo({ top: Math.min(maxScrollTop, Math.max(0, centeredTop)), behavior: "auto" });
      return;
    }

    target.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" });
  }, []);

  useEffect(() => {
    if (didAutoScroll.current || scrollTargetPeriod === null) return;
    let positioningFrame: number | null = null;
    const layoutFrame = window.requestAnimationFrame(() => {
      positioningFrame = window.requestAnimationFrame(() => {
        const target = scrollTargetRef.current;
        if (!target) return;
        scrollToCurrentPeriod();
        didAutoScroll.current = true;
        updateReturnToCurrentVisibility();
      });
    });
    return () => {
      window.cancelAnimationFrame(layoutFrame);
      if (positioningFrame !== null) window.cancelAnimationFrame(positioningFrame);
    };
  }, [scrollTargetPeriod, scrollToCurrentPeriod, updateReturnToCurrentVisibility]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(updateReturnToCurrentVisibility);
    window.addEventListener("resize", updateReturnToCurrentVisibility);
    window.addEventListener("scroll", updateReturnToCurrentVisibility, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updateReturnToCurrentVisibility);
      window.removeEventListener("scroll", updateReturnToCurrentVisibility);
    };
  }, [updateReturnToCurrentVisibility]);

  const returnToCurrentPeriod = useCallback(() => {
    scrollToCurrentPeriod();
    window.requestAnimationFrame(updateReturnToCurrentVisibility);
  }, [scrollToCurrentPeriod, updateReturnToCurrentVisibility]);

  return <section className={styles.dayPanel} aria-labelledby={`day-${day.date}`}>
    <header className={styles.dayHeader}>
      <div><span className={styles.dayEyebrow}>Розклад занять</span><h2 id={`day-${day.date}`}>{dateLabel(day.date)}</h2>
        {liveStatus ? <p className={styles.liveStatus} data-state={liveStatus.kind} role="status" aria-live="polite">
          <strong>{liveStatus.title}</strong><span>{liveStatus.detail}</span>
        </p> : null}
      </div>
      <div className={styles.dayFlags}>
        {day.isTransfer ? <span className={styles.transferBadge}>За розкладом: {calendarDayLabel(day.scheduleDayOfWeek)}</span> : null}
        <span className={styles.dayWeek}>{day.weekType === "numerator" ? "Чисельник" : "Знаменник"}</span>
      </div>
    </header>
    <div
      className={styles.periodGrid}
      id={`period-grid-${day.date}`}
      ref={periodGridRef}
      tabIndex={0}
      aria-label={`Пари на ${dateLabel(day.date)}`}
      onScroll={updateReturnToCurrentVisibility}
    >
      {periods.map((period) => {
        const items = byPeriod.get(period.number) ?? [];
        const status = periodStatus(period, day.date, clock);
        return <div
          className={`${styles.periodRow} ${styles[status]}`}
          key={period.id}
          ref={period.number === scrollTargetPeriod ? scrollTargetRef : undefined}
        >
          <div
            className={styles.periodCell}
            style={{ "--period-color": period.color, "--period-foreground": periodColorForeground(period.color) } as CSSProperties}
          >
            <FreeRoomPopover date={day.date} period={period} />
            <span className={styles.periodTimes}>{period.startTime}<i aria-hidden="true">↓</i>{period.endTime}</span>
            {status === "current" ? <strong className={styles.nowBadge}>Зараз</strong> : null}
          </div>
          <div className={`${styles.lessonCell} ${items.length ? "" : styles.freeCell}`}>
            {items.length ? items.map((item) => <LessonCard key={`${item.id}:${item.occurrenceDate}`} item={item} />) : <span className={styles.freeLabel}>Вільно</span>}
          </div>
        </div>;
      })}
      {!periods.length ? <p className={styles.noPeriods}>Адміністратор ще не додав активні пари.</p> : null}
    </div>
    {showReturnToCurrent && scrollTargetPeriod !== null ? <button
      type="button"
      className={styles.currentPeriodButton}
      aria-controls={`period-grid-${day.date}`}
      onClick={returnToCurrentPeriod}
    ><span aria-hidden="true">↑</span> До поточної пари</button> : null}
  </section>;
}

function TeacherFilter({
  selectedTeacherId,
  teachers,
  isPending,
  onSelect,
}: {
  selectedTeacherId: string;
  teachers: readonly PublicTeacher[];
  isPending: boolean;
  onSelect: (teacherId: string) => void;
}) {
  const options = useMemo<readonly TeacherOption[]>(() => [
    { value: "", label: "Всі викладачі" },
    ...teachers.map((teacher) => ({ value: teacher.id, label: teacher.name })),
  ], [teachers]);
  const selectedTeacher = options.find((option) => option.value === selectedTeacherId) ?? options[0];

  return <div className={styles.teacherFilter} aria-busy={isPending}>
    <Combobox.Root
      items={options}
      value={selectedTeacher}
      onValueChange={(option) => {
        if (!option || option.value === selectedTeacherId) return;
        onSelect(option.value);
      }}
      isItemEqualToValue={(option, value) => option.value === value.value}
      autoHighlight
      locale="uk"
    >
      <Combobox.InputGroup className={styles.teacherCombobox}>
        <Search className={styles.teacherSearchIcon} aria-hidden="true" />
        <Combobox.Input
          className={styles.teacherComboboxInput}
          aria-label="Пошук викладача"
          placeholder="Знайти викладача"
          autoComplete="off"
        />
        <Combobox.Trigger className={styles.teacherComboboxTrigger} aria-label="Відкрити список викладачів">
          {isPending ? <span className={styles.pendingSpinner} aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
        </Combobox.Trigger>
      </Combobox.InputGroup>
      <Combobox.Portal>
        <Combobox.Positioner className={styles.teacherComboboxPositioner} sideOffset={5} align="start">
          <Combobox.Popup className={styles.teacherComboboxPopup}>
            <Combobox.Empty className={styles.teacherComboboxEmpty}>Викладача не знайдено</Combobox.Empty>
            <Combobox.List className={styles.teacherComboboxList}>
              {(option: TeacherOption) => <Combobox.Item
                key={option.value || "all"}
                className={styles.teacherComboboxItem}
                value={option}
              >
                <span>{option.label}</span>
                <Combobox.ItemIndicator className={styles.teacherComboboxIndicator}>
                  <Check aria-hidden="true" />
                </Combobox.ItemIndicator>
              </Combobox.Item>}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
    <span className="sr-only" role="status" aria-live="polite">
      {isPending ? "Завантаження розкладу викладача…" : ""}
    </span>
  </div>;
}

function MobileScheduleOptions({
  selectedTeacherId,
  teachers,
  isTeacherPending,
  selectedDate,
  isDatePending,
  onTeacherSelect,
  onDateSelect,
}: {
  selectedTeacherId: string;
  teachers: readonly PublicTeacher[];
  isTeacherPending: boolean;
  selectedDate: string;
  isDatePending: boolean;
  onTeacherSelect: (teacherId: string) => void;
  onDateSelect: (date: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [screen, setScreen] = useState<"overview" | "push">("overview");
  const backButtonRef = useRef<HTMLButtonElement>(null);
  const pushLinkRef = useRef<HTMLButtonElement>(null);
  const previousScreenRef = useRef(screen);

  useEffect(() => {
    const previousScreen = previousScreenRef.current;
    previousScreenRef.current = screen;
    if (!open) return;
    if (screen === "push") {
      backButtonRef.current?.focus();
    } else if (previousScreen === "push") {
      pushLinkRef.current?.focus();
    }
  }, [open, screen]);

  return <Dialog.Root
    open={open}
    onOpenChange={(nextOpen) => {
      setOpen(nextOpen);
      if (!nextOpen) setScreen("overview");
    }}
    modal
  >
    <Dialog.Trigger
      className={styles.mobileOptionsTrigger}
      type="button"
      aria-label="Відкрити налаштування розкладу та сповіщень"
    >
      <Settings aria-hidden="true" />
    </Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Backdrop className={styles.mobileOptionsBackdrop} />
      <Dialog.Viewport className={styles.mobileOptionsViewport}>
        <Dialog.Popup className={styles.mobileOptionsPopup} data-screen={screen} initialFocus finalFocus>
          <header className={styles.mobileOptionsHeader}>
            {screen === "overview" ? <div>
              <Dialog.Title className={styles.mobileOptionsTitle}>Налаштування</Dialog.Title>
              <Dialog.Description className={styles.mobileOptionsDescription}>Перегляд і застосунок</Dialog.Description>
            </div> : <>
              <Dialog.Title className="sr-only">Налаштування сповіщень</Dialog.Title>
              <Dialog.Description className="sr-only">Виберіть викладача та події для цього пристрою.</Dialog.Description>
              <button
                className={styles.mobileOptionsBack}
                type="button"
                onClick={() => setScreen("overview")}
                ref={backButtonRef}
              >
                <ChevronLeft aria-hidden="true" /> Налаштування
              </button>
            </>}
            <Dialog.Close
              className={styles.mobileOptionsClose}
              aria-label={screen === "push" ? "Закрити налаштування сповіщень" : "Закрити налаштування"}
            >
              <X aria-hidden="true" />
            </Dialog.Close>
          </header>
          {screen === "overview" ? <div className={styles.mobileOptionsContent}>
              <section className={styles.mobileOptionsSection} aria-labelledby="mobile-teacher-filter-label">
                <h3 id="mobile-teacher-filter-label">Викладач</h3>
                <TeacherFilter
                  selectedTeacherId={selectedTeacherId}
                  teachers={teachers}
                  isPending={isTeacherPending}
                  onSelect={onTeacherSelect}
                />
              </section>
              <section className={styles.mobileOptionsSection} aria-labelledby="mobile-date-filter-label">
                <h3 id="mobile-date-filter-label">Інша дата</h3>
                <form className={styles.dateForm} autoComplete="off" onSubmit={(event) => {
                  event.preventDefault();
                  const value = String(new FormData(event.currentTarget).get("date") ?? "");
                  if (isPublicDateKey(value)) onDateSelect(value);
                }}>
                  <label key={selectedDate}><span className="sr-only">Дата розкладу</span><input type="date" name="date" defaultValue={selectedDate} required /></label>
                  <button type="submit">Перейти<PendingControlStatus pending={isDatePending} label="вибрану дату" /></button>
                </form>
              </section>
              <section className={styles.mobileOptionsSection} aria-labelledby="mobile-app-label">
                <h3 id="mobile-app-label">Застосунок</h3>
                <div className={styles.mobilePwaControl}><PwaControls /></div>
              </section>
              <section className={styles.mobileOptionsSection} aria-label="Налаштування сповіщень">
                <button
                  className={styles.mobilePushLink}
                  type="button"
                  onClick={() => setScreen("push")}
                  ref={pushLinkRef}
                >
                  <span><strong>Сповіщення</strong><small>Вибрати викладача й події</small></span>
                  <ChevronRight aria-hidden="true" />
                </button>
              </section>
            </div> : <div className={styles.mobileOptionsPushContent}>
              <PublicPushSettings
                teachers={teachers}
                onTeacherSaved={onTeacherSelect}
                preferredTeacherId={selectedTeacherId}
                variant="mobile"
              />
            </div>}
        </Dialog.Popup>
      </Dialog.Viewport>
    </Dialog.Portal>
  </Dialog.Root>;
}

function DesktopPushSettings({
  teachers,
  onTeacherSaved,
}: {
  teachers: readonly PublicTeacher[];
  onTeacherSaved: (teacherId: string) => void;
}) {
  return <Popover.Root>
    <Popover.Trigger
      className={styles.pushSettingsTrigger}
      type="button"
      aria-label="Відкрити налаштування сповіщень"
      title="Налаштувати сповіщення"
    ><Settings aria-hidden="true" /></Popover.Trigger>
    <Popover.Portal>
      <Popover.Positioner className={styles.pushSettingsPositioner} side="bottom" align="end" sideOffset={8} collisionPadding={10}>
        <Popover.Popup className={styles.pushSettingsPopup} initialFocus finalFocus>
          <Popover.Title className="sr-only">Налаштування сповіщень</Popover.Title>
          <Popover.Description className="sr-only">Виберіть викладача та події для цього пристрою.</Popover.Description>
          <PublicPushSettings teachers={teachers} onTeacherSaved={onTeacherSaved} />
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  </Popover.Root>;
}

export function PublicScheduleExplorer({
  periods,
  initialDay,
  initialTeacherId,
  teachers,
}: {
  periods: readonly PublicPeriod[];
  initialDay: PublicScheduleDay;
  initialTeacherId: string;
  teachers: readonly PublicTeacher[];
}) {
  const [now, setNow] = useState<Date | null>(null);
  const [day, setDay] = useState(initialDay);
  const [selectedTeacherId, setSelectedTeacherId] = useState(initialTeacherId);
  const [pendingSelection, setPendingSelection] = useState<ScheduleSelection | null>(null);
  const [failure, setFailure] = useState<LoadFailure | null>(null);
  const requestCounter = useRef(0);
  const activeRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    const update = () => setNow(new Date());
    update();
    const timer = window.setInterval(update, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => () => activeRequest.current?.abort(), []);

  const clock = kyivClock(now);
  const selectedDate = day.date;
  const navigationDays = useMemo(() => publicNavigationWeek(
    pendingSelection?.date ?? selectedDate,
  ), [pendingSelection?.date, selectedDate]);

  const loadSchedule = useCallback(async (
    selection: ScheduleSelection,
    persistTeacher: boolean,
  ) => {
    const requestId = ++requestCounter.current;
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setPendingSelection(selection);
    setFailure(null);

    try {
      const response = await fetch(publicScheduleRequestUrl(selection), {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => null) as {
        data?: PublicScheduleDay;
        error?: { message?: string };
      } | null;
      if (!response.ok || !payload?.data) {
        throw new Error(payload?.error?.message || "Не вдалося завантажити розклад.");
      }
      if (requestId !== requestCounter.current) return;
      setDay(payload.data);
      setSelectedTeacherId(selection.teacherId);
      if (persistTeacher) persistTeacherPreference(selection.teacherId);
    } catch (error) {
      if (controller.signal.aborted || requestId !== requestCounter.current) return;
      setFailure({
        message: error instanceof Error && error.message !== "Failed to fetch"
          ? error.message
          : "Не вдалося завантажити розклад.",
        selection,
        persistTeacher,
      });
    } finally {
      if (requestId === requestCounter.current) {
        activeRequest.current = null;
        setPendingSelection(null);
      }
    }
  }, []);

  useEffect(() => {
    let requestedDate: string | null = null;
    try {
      requestedDate = window.sessionStorage.getItem(PUBLIC_DATE_HANDOFF_STORAGE);
    } catch {
      return;
    }
    if (requestedDate && isPublicDateKey(requestedDate) && requestedDate !== initialDay.date) {
      const timer = window.setTimeout(() => {
        try {
          window.sessionStorage.removeItem(PUBLIC_DATE_HANDOFF_STORAGE);
        } catch {
          // The handoff still works when storage cleanup is unavailable.
        }
        void loadSchedule({ date: requestedDate, teacherId: initialTeacherId }, false);
      }, 0);
      return () => window.clearTimeout(timer);
    }
    try {
      window.sessionStorage.removeItem(PUBLIC_DATE_HANDOFF_STORAGE);
    } catch {
      // Reading succeeded above, but privacy settings may still reject cleanup.
    }
  }, [initialDay.date, initialTeacherId, loadSchedule]);

  const navigateToDate = useCallback((date: string) => {
    void loadSchedule({ date, teacherId: selectedTeacherId }, false);
  }, [loadSchedule, selectedTeacherId]);

  const pendingDate = pendingSelection?.date;
  const navigationBaseDate = pendingDate ?? selectedDate;
  const previousDate = addPublicScheduleDays(navigationBaseDate, -1);
  const todayDate = clock.dateKey || initialDay.date;
  const nextDate = addPublicScheduleDays(navigationBaseDate, 1);
  const isTeacherPending = pendingSelection !== null && pendingSelection.teacherId !== selectedTeacherId;

  const selectTeacher = (teacherId: string) => void loadSchedule({ date: navigationBaseDate, teacherId }, true);
  const selectExactDate = (date: string) => navigateToDate(date);

  const toolbar = <section className={styles.statusBar} aria-label="Поточний стан розкладу">
    <div className={styles.desktopToolbar}>
      <div className={styles.clock}><strong suppressHydrationWarning>{clock.time}</strong><span suppressHydrationWarning>{clock.date}</span></div>
      <nav className={styles.dateNavigation} aria-label="Навігація за датою">
        <button type="button" aria-label="Попередній день" onClick={() => navigateToDate(previousDate)}>←<PendingControlStatus pending={pendingDate === previousDate} label="попередній день" /></button>
        <button type="button" onClick={() => navigateToDate(todayDate)}>Сьогодні<PendingControlStatus pending={pendingDate === todayDate} label="розклад на сьогодні" /></button>
        <button type="button" aria-label="Наступний день" onClick={() => navigateToDate(nextDate)}>→<PendingControlStatus pending={pendingDate === nextDate} label="наступний день" /></button>
      </nav>
      <TeacherFilter
        selectedTeacherId={selectedTeacherId}
        teachers={teachers}
        isPending={isTeacherPending}
        onSelect={selectTeacher}
      />
      <form className={styles.dateForm} autoComplete="off" onSubmit={(event) => {
        event.preventDefault();
        const value = String(new FormData(event.currentTarget).get("date") ?? "");
        if (isPublicDateKey(value)) selectExactDate(value);
      }}>
        <label key={selectedDate}><span className="sr-only">Дата розкладу</span><input type="date" name="date" defaultValue={selectedDate} required /></label>
        <button type="submit">Перейти<PendingControlStatus pending={pendingSelection !== null && !isTeacherPending} label="вибрану дату" /></button>
      </form>
      <div className={styles.statusActions}>
        <PwaControls />
        <DesktopPushSettings teachers={teachers} onTeacherSaved={selectTeacher} />
        <span className={styles.weekBadge}>{day.weekType === "denominator" ? "Знаменник" : "Чисельник"}</span>
      </div>
    </div>
    <div className={styles.mobileToolbar}>
      <nav className={styles.mobileDateNavigation} aria-label="Навігація за датою">
        <button type="button" aria-label="Попередній день" onClick={() => navigateToDate(previousDate)}>
          <ChevronLeft aria-hidden="true" /><PendingControlStatus pending={pendingDate === previousDate} label="попередній день" />
        </button>
        <button type="button" className={styles.mobileDayButton} aria-label="Перейти до сьогоднішнього дня" onClick={() => navigateToDate(todayDate)}>
          <CalendarDays aria-hidden="true" />
          <span>{compactMobileDateLabel(navigationBaseDate, todayDate)}</span>
          <small>{day.weekType === "denominator" ? "Знаменник" : "Чисельник"}</small>
          <PendingControlStatus pending={pendingDate === todayDate} label="розклад на сьогодні" />
        </button>
        <button type="button" aria-label="Наступний день" onClick={() => navigateToDate(nextDate)}>
          <ChevronRight aria-hidden="true" /><PendingControlStatus pending={pendingDate === nextDate} label="наступний день" />
        </button>
      </nav>
      <MobileScheduleOptions
        selectedTeacherId={selectedTeacherId}
        teachers={teachers}
        isTeacherPending={isTeacherPending}
        selectedDate={selectedDate}
        isDatePending={pendingSelection !== null && !isTeacherPending}
        onTeacherSelect={selectTeacher}
        onDateSelect={selectExactDate}
      />
    </div>
    </section>;

  const dayTabs = <nav className={styles.dayTabs} aria-label="Дні поточного тижня">
      {navigationDays.map((navigationDay) => <button
        type="button"
        key={navigationDay.date}
        onClick={() => navigateToDate(navigationDay.date)}
        aria-current={navigationDay.date === (pendingDate ?? selectedDate) ? "date" : undefined}
      ><span>{navigationDay.shortLabel}</span><small>{navigationDay.dayLabel}</small><PendingControlStatus pending={pendingDate === navigationDay.date} label={`розклад на ${navigationDay.dayLabel}`} /></button>)}
    </nav>;

  return <div className={styles.scheduleShell}>
    <PublicHeader toolbar={toolbar} footer={dayTabs} />
    <main className={styles.workspace} aria-busy={pendingSelection !== null}>
    <section className={styles.scheduleArea}>
      {failure ? <div className={styles.loadError} role="alert">
        <span>{failure.message}</span>
        <button type="button" onClick={() => void loadSchedule(failure.selection, failure.persistTeacher)}>Спробувати ще раз</button>
      </div> : null}
      <div className={styles.days}>
        <DaySchedule key={day.date} day={day} periods={periods} clock={clock} />
      </div>
    </section>
    </main>
  </div>;
}
