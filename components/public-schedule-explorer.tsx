"use client";

import Link, { useLinkStatus } from "next/link";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { periodColorForeground } from "@/lib/class-periods/colors";
import type {
  PublicGroup,
  PublicPeriod,
  PublicScheduleDay,
  PublicScheduleItem,
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
};

type NavigationDay = Readonly<{ date: string; shortLabel: string; dayLabel: string }>;

function PendingLinkStatus({ label }: { label: string }) {
  const { pending } = useLinkStatus();
  return <>
    {pending ? <span className={styles.pendingOverlay} aria-hidden="true"><span className={styles.pendingSpinner} /></span> : null}
    <span className="sr-only" role="status" aria-atomic="true">{pending ? `Завантаження: ${label}…` : ""}</span>
  </>;
}

function scheduleHref(input: { date: string; groupId: string; view: "day" | "week" }): string {
  const query = new URLSearchParams({ date: input.date, view: input.view });
  if (input.groupId) query.set("group", input.groupId);
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

function GroupLinks({ groups, selectedGroupId, date, view, query }: {
  groups: readonly PublicGroup[];
  selectedGroupId: string;
  date: string;
  view: "day" | "week";
  query: string;
}) {
  const normalized = query.normalize("NFC").trim().toLocaleLowerCase("uk-UA");
  const visible = normalized
    ? groups.filter((group) => group.name.toLocaleLowerCase("uk-UA").includes(normalized))
    : groups;
  if (!groups.length) return <p className={styles.groupsEmpty}>Активних груп ще немає.</p>;
  if (!visible.length) return <p className={styles.groupsEmpty}>Групу не знайдено.</p>;
  return <div className={styles.groupLinks}>
    {visible.map((group) => <Link
      key={group.id}
      href={scheduleHref({ date, groupId: group.id, view })}
      className={styles.groupLink}
      aria-current={group.id === selectedGroupId ? "page" : undefined}
      scroll={false}
    >
      <span>{group.name}</span>
      {group.id === selectedGroupId ? <small>Обрано</small> : null}
      <PendingLinkStatus label={`розклад групи ${group.name}`} />
    </Link>)}
  </div>;
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
      <div><span className={styles.dayEyebrow}>Розклад групи</span><h2 id={`day-${day.date}`}>{dateLabel(day.date)}</h2></div>
      <span className={styles.dayWeek}>{day.weekType === "numerator" ? "Чисельник" : "Знаменник"}</span>
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

export function PublicScheduleExplorer({ groups, periods, days, navigationDays, selectedDate, selectedGroupId, view }: {
  groups: readonly PublicGroup[];
  periods: readonly PublicPeriod[];
  days: readonly PublicScheduleDay[];
  navigationDays: readonly NavigationDay[];
  selectedDate: string;
  selectedGroupId: string;
  view: "day" | "week";
}) {
  const [now, setNow] = useState<Date | null>(null);
  const [groupQuery, setGroupQuery] = useState("");
  const mobileGroupsRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const update = () => setNow(new Date());
    update();
    const timer = window.setInterval(update, 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const clock = kyivClock(now);
  const selectedGroup = groups.find((group) => group.id === selectedGroupId) ?? null;
  const dayStep = view === "week" ? 7 : 1;

  return <main className={styles.workspace}>
    <section className={styles.statusBar} aria-label="Поточний стан розкладу">
      <div className={styles.clock}><strong suppressHydrationWarning>{clock.time}</strong><span suppressHydrationWarning>{clock.date}</span></div>
      <div className={styles.currentGroup}><span>Обрана група</span><strong>{selectedGroup?.name ?? "Оберіть групу"}</strong></div>
      <div className={styles.statusActions}>
        <span className={styles.weekBadge}>{days[0]?.weekType === "denominator" ? "Знаменник" : "Чисельник"}</span>
        <nav className={styles.mode} aria-label="Формат розкладу">
          <Link href={scheduleHref({ date: selectedDate, groupId: selectedGroupId, view: "day" })} aria-current={view === "day" ? "page" : undefined}>День<PendingLinkStatus label="денний розклад" /></Link>
          <Link href={scheduleHref({ date: selectedDate, groupId: selectedGroupId, view: "week" })} aria-current={view === "week" ? "page" : undefined}>Тиждень<PendingLinkStatus label="тижневий розклад" /></Link>
        </nav>
      </div>
    </section>

    <nav className={styles.dayTabs} aria-label="Дні поточного тижня">
      {navigationDays.map((day) => <Link
        key={day.date}
        href={scheduleHref({ date: day.date, groupId: selectedGroupId, view: "day" })}
        aria-current={day.date === selectedDate ? "date" : undefined}
      ><span>{day.shortLabel}</span><small>{day.dayLabel}</small><PendingLinkStatus label={`розклад на ${day.dayLabel}`} /></Link>)}
    </nav>

    <div className={styles.workspaceGrid}>
      <aside className={styles.groupsPanel} aria-label="Список навчальних груп">
        <header><div><span className={styles.panelEyebrow}>Навчальні групи</span><strong>{groups.length} активних</strong></div></header>
        <label className={styles.groupSearch}><span className="sr-only">Пошук групи</span><input type="search" placeholder="Пошук групи…" value={groupQuery} onChange={(event) => setGroupQuery(event.target.value)} /></label>
        <GroupLinks groups={groups} selectedGroupId={selectedGroupId} date={selectedDate} view={view} query={groupQuery} />
      </aside>

      <section className={styles.scheduleArea}>
        <details
          className={styles.mobileGroups}
          ref={mobileGroupsRef}
          onKeyDown={(event) => {
            if (event.key !== "Escape" || !mobileGroupsRef.current?.open) return;
            event.preventDefault();
            mobileGroupsRef.current.open = false;
            mobileGroupsRef.current.querySelector("summary")?.focus();
          }}
        >
          <summary>Групи <span>{selectedGroup?.name ?? "Оберіть"}</span></summary>
          <div className={styles.mobileGroupsBody}>
            <label className={styles.groupSearch}><span className="sr-only">Пошук групи</span><input type="search" placeholder="Пошук групи…" value={groupQuery} onChange={(event) => setGroupQuery(event.target.value)} /></label>
            <GroupLinks groups={groups} selectedGroupId={selectedGroupId} date={selectedDate} view={view} query={groupQuery} />
          </div>
        </details>

        <div className={styles.scheduleToolbar}>
          <div className={styles.dateNavigation}>
            <Link aria-label={view === "week" ? "Попередній тиждень" : "Попередній день"} href={scheduleHref({ date: addDays(selectedDate, -dayStep), groupId: selectedGroupId, view })}>←<PendingLinkStatus label={view === "week" ? "попередній тиждень" : "попередній день"} /></Link>
            <Link href={scheduleHref({ date: clock.dateKey || selectedDate, groupId: selectedGroupId, view })}>Сьогодні<PendingLinkStatus label="розклад на сьогодні" /></Link>
            <Link aria-label={view === "week" ? "Наступний тиждень" : "Наступний день"} href={scheduleHref({ date: addDays(selectedDate, dayStep), groupId: selectedGroupId, view })}>→<PendingLinkStatus label={view === "week" ? "наступний тиждень" : "наступний день"} /></Link>
          </div>
          <form method="get" className={styles.dateForm}>
            <label><span className="sr-only">Дата розкладу</span><input type="date" name="date" defaultValue={selectedDate} /></label>
            <input type="hidden" name="group" value={selectedGroupId} />
            <input type="hidden" name="view" value={view} />
            <button type="submit">Перейти</button>
          </form>
        </div>

        {!selectedGroupId ? <p className={styles.emptySelection}>Оберіть групу зі списку, щоб переглянути її розклад.</p> : <div className={styles.days}>
          {days.map((day) => <DaySchedule key={day.date} day={day} periods={periods} clock={clock} />)}
        </div>}
      </section>
    </div>
  </main>;
}
