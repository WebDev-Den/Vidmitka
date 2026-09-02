import { ArrowLeft, ArrowRight, CalendarDays, List } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";

import { HomePeriodGrid } from "@/components/home-period-grid";
import { ScheduleDayNotice } from "@/components/schedule-day-notice";
import { listClassPeriods } from "@/lib/class-periods/repository";
import { LESSON_DAYS } from "@/lib/lessons/rules";
import { formatScheduleDate, shiftScheduleDate } from "@/lib/schedule-calendar/presentation";
import { listScheduleForDate } from "@/lib/schedule-calendar/schedule";
import {
  formatWeekTypeLabel,
  getDateKeyInTimeZone,
  validateScheduleWeekSettings,
} from "@/lib/schedule-week/rules";

import styles from "./home-schedule-board.module.css";

function homeDateHref(date: string): string {
  return `/?${new URLSearchParams({ date }).toString()}`;
}

function lessonCountLabel(count: number): string {
  const lastTwoDigits = count % 100;
  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return "занять";
  if (count % 10 === 1) return "заняття";
  if (count % 10 >= 2 && count % 10 <= 4) return "заняття";
  return "занять";
}

export async function HomeScheduleBoard({ selectedDate }: { selectedDate?: string | string[] }) {
  await connection();
  const today = getDateKeyInTimeZone(new Date());
  const parsedDate = typeof selectedDate === "string"
    ? validateScheduleWeekSettings({ numeratorDate: selectedDate })
    : null;
  const invalidDate = selectedDate !== undefined && parsedDate?.ok !== true;
  const date = parsedDate?.ok ? parsedDate.value.anchorDate : today;

  try {
    const [{ day, view, lessons }, periods] = await Promise.all([
      listScheduleForDate(date),
      listClassPeriods({ activeOnly: true }),
    ]);
    const previousDate = shiftScheduleDate(date, -1);
    const nextDate = shiftScheduleDate(date, 1);
    const dayName = LESSON_DAYS[day.calendarDayOfWeek - 1];

    return <section className={styles.board} aria-labelledby="home-schedule-heading">
      <div className={styles.headingRow}>
        <div className={styles.heading}>
          <span className="eyebrow">РОЗКЛАД НА ДЕНЬ</span>
          <h1 id="home-schedule-heading">{date === today ? "Сьогоднішні заняття" : "Заняття на вибрану дату"}</h1>
          <p>
            {dayName} · <time dateTime={date}>{formatScheduleDate(date)}</time>
            {view.weekType ? ` · ${formatWeekTypeLabel(view.weekType)}` : " · Тиждень не налаштовано"}
          </p>
        </div>
        <div className={styles.summary} aria-label="Кількість занять">
          <strong>{lessons.length}</strong>
          <span>{lessonCountLabel(lessons.length)}</span>
        </div>
      </div>

      {invalidDate ? <p className={styles.notice} role="alert">
        Некоректна дата. Показано сьогоднішній розклад.
      </p> : null}
      <ScheduleDayNotice day={day} />

      <div className={styles.controls}>
        <nav className={styles.dayNavigation} aria-label="Навігація за датами">
          {previousDate ? <Link href={homeDateHref(previousDate)} aria-label="Попередній день">
            <ArrowLeft size={17} aria-hidden="true" />
          </Link> : <span />}
          <Link className={styles.todayLink} href="/">Сьогодні</Link>
          {nextDate ? <Link href={homeDateHref(nextDate)} aria-label="Наступний день">
            <ArrowRight size={17} aria-hidden="true" />
          </Link> : <span />}
        </nav>

        <details className={styles.datePicker}>
          <summary><CalendarDays size={17} aria-hidden="true" /> Інша дата</summary>
          <form action="/" method="get">
            <label htmlFor="home-schedule-date">Дата розкладу</label>
            <input id="home-schedule-date" name="date" type="date" defaultValue={date}
              min="0001-01-01" max="9999-12-31" required />
            <button className="button button-primary" type="submit">Показати</button>
          </form>
        </details>

        <Link className={styles.fullScheduleLink} href={`/schedule?date=${encodeURIComponent(date)}`}>
          <List size={17} aria-hidden="true" /> Повний розклад
        </Link>
      </div>

      <HomePeriodGrid
        initialNow={Date.now()}
        lessons={lessons}
        periods={periods.map(({ id, number, startMinute, endMinute, isActive, color }) => ({
          id, number, startMinute, endMinute, isActive, color,
        }))}
        selectedDate={date}
      />
    </section>;
  } catch {
    return <section className={`${styles.board} ${styles.error}`} aria-labelledby="home-schedule-heading">
      <CalendarDays size={28} aria-hidden="true" />
      <h1 id="home-schedule-heading">Розклад тимчасово недоступний</h1>
      <p role="status">Не вдалося завантажити заняття. Спробуйте оновити сторінку пізніше.</p>
      <Link className="button button-primary" href="/schedule">Відкрити повний розклад</Link>
    </section>;
  }
}
