"use client";

import { Combobox } from "@base-ui/react/combobox";
import { Check, ChevronDown, Search } from "lucide-react";
import Link, { useLinkStatus } from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition, type CSSProperties } from "react";

import { periodColorForeground } from "@/lib/class-periods/colors";
import { calendarDayLabel } from "@/lib/schedule-v2/calendar-override-rules";
import type {
  PublicPeriod,
  PublicScheduleDay,
  PublicScheduleItem,
  PublicTeacher,
} from "@/lib/schedule-v2/public-schedule";

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

type NavigationDay = Readonly<{ date: string; shortLabel: string; dayLabel: string }>;
type TeacherOption = Readonly<{ value: string; label: string }>;

function PendingLinkStatus({ label }: { label: string }) {
  const { pending } = useLinkStatus();
  return <>
    {pending ? <span className={styles.pendingOverlay} aria-hidden="true"><span className={styles.pendingSpinner} /></span> : null}
    <span className="sr-only" role="status" aria-atomic="true">{pending ? `Завантаження: ${label}…` : ""}</span>
  </>;
}

function scheduleHref(input: { date: string; teacherId: string }): string {
  const query = new URLSearchParams({ date: input.date });
  if (input.teacherId) query.set("teacher", input.teacherId);
  return `/schedule?${query.toString()}`;
}

function addDays(date: string, amount: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
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
  const byPeriod = useMemo(() => {
    const result = new Map<number, PublicScheduleItem[]>();
    for (const item of day.items) {
      const values = result.get(item.periodNumber) ?? [];
      values.push(item);
      result.set(item.periodNumber, values);
    }
    return result;
  }, [day.items]);

  return <section className={styles.dayPanel} aria-labelledby={`day-${day.date}`}>
    <header className={styles.dayHeader}>
      <div><span className={styles.dayEyebrow}>Розклад занять</span><h2 id={`day-${day.date}`}>{dateLabel(day.date)}</h2></div>
      <div className={styles.dayFlags}>
        {day.isTransfer ? <span className={styles.transferBadge}>За розкладом: {calendarDayLabel(day.scheduleDayOfWeek)}</span> : null}
        <span className={styles.dayWeek}>{day.weekType === "numerator" ? "Чисельник" : "Знаменник"}</span>
      </div>
    </header>
    <div className={styles.periodGrid}>
      {periods.map((period) => {
        const items = byPeriod.get(period.number) ?? [];
        const status = periodStatus(period, day.date, clock);
        return <div className={`${styles.periodRow} ${styles[status]}`} key={period.id}>
          <div
            className={styles.periodCell}
            style={{ "--period-color": period.color, "--period-foreground": periodColorForeground(period.color) } as CSSProperties}
          >
            <span className={styles.periodNumber}>{period.number}</span>
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
  </section>;
}

function TeacherFilter({
  selectedDate,
  selectedTeacherId,
  teachers,
}: {
  selectedDate: string;
  selectedTeacherId: string;
  teachers: readonly PublicTeacher[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const options = useMemo<readonly TeacherOption[]>(() => [
    { value: "", label: "Всі викладачі" },
    ...teachers.map((teacher) => ({ value: teacher.id, label: teacher.name })),
  ], [teachers]);
  const selectedTeacher = options.find((option) => option.value === selectedTeacherId) ?? options[0];

  return <div className={styles.teacherFilter} aria-busy={isPending}>
    <Combobox.Root
      key={selectedTeacherId || "all"}
      items={options}
      defaultValue={selectedTeacher}
      onValueChange={(option) => {
        if (!option || option.value === selectedTeacherId) return;
        startTransition(() => router.push(scheduleHref({ date: selectedDate, teacherId: option.value })));
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

export function PublicScheduleExplorer({
  periods,
  days,
  navigationDays,
  selectedDate,
  selectedTeacherId,
  teachers,
}: {
  periods: readonly PublicPeriod[];
  days: readonly PublicScheduleDay[];
  navigationDays: readonly NavigationDay[];
  selectedDate: string;
  selectedTeacherId: string;
  teachers: readonly PublicTeacher[];
}) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const update = () => setNow(new Date());
    update();
    const timer = window.setInterval(update, 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const clock = kyivClock(now);

  return <main className={styles.workspace}>
    <section className={styles.statusBar} aria-label="Поточний стан розкладу">
      <div className={styles.clock}><strong suppressHydrationWarning>{clock.time}</strong><span suppressHydrationWarning>{clock.date}</span></div>
      <nav className={styles.dateNavigation} aria-label="Навігація за датою">
        <Link aria-label="Попередній день" href={scheduleHref({ date: addDays(selectedDate, -1), teacherId: selectedTeacherId })}>←<PendingLinkStatus label="попередній день" /></Link>
        <Link href={scheduleHref({ date: clock.dateKey || selectedDate, teacherId: selectedTeacherId })}>Сьогодні<PendingLinkStatus label="розклад на сьогодні" /></Link>
        <Link aria-label="Наступний день" href={scheduleHref({ date: addDays(selectedDate, 1), teacherId: selectedTeacherId })}>→<PendingLinkStatus label="наступний день" /></Link>
      </nav>
      <TeacherFilter selectedDate={selectedDate} selectedTeacherId={selectedTeacherId} teachers={teachers} />
      <form method="get" className={styles.dateForm} autoComplete="off">
        <label><span className="sr-only">Дата розкладу</span><input type="date" name="date" defaultValue={selectedDate} /></label>
        {selectedTeacherId ? <input type="hidden" name="teacher" value={selectedTeacherId} /> : null}
        <button type="submit">Перейти</button>
      </form>
      <div className={styles.statusActions}>
        <span className={styles.weekBadge}>{days[0]?.weekType === "denominator" ? "Знаменник" : "Чисельник"}</span>
      </div>
    </section>

    <nav className={styles.dayTabs} aria-label="Дні поточного тижня">
      {navigationDays.map((day) => <Link
        key={day.date}
        href={scheduleHref({ date: day.date, teacherId: selectedTeacherId })}
        aria-current={day.date === selectedDate ? "date" : undefined}
      ><span>{day.shortLabel}</span><small>{day.dayLabel}</small><PendingLinkStatus label={`розклад на ${day.dayLabel}`} /></Link>)}
    </nav>

    <section className={styles.scheduleArea}>
      <div className={styles.days}>
        {days.map((day) => <DaySchedule key={day.date} day={day} periods={periods} clock={clock} />)}
      </div>
    </section>
  </main>;
}
