"use client";

import { DayPicker } from "@daypicker/react";
import { uk } from "@daypicker/react/locale/uk";
import { ArrowLeft, ArrowRight, CalendarDays, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import {
  calendarDate, calendarDateKey, formatScheduleDate, scheduleDateHref, shiftScheduleDate, type SchedulePath,
} from "@/lib/schedule-calendar/presentation";
import { getDateKeyInTimeZone } from "@/lib/schedule-week/rules";

import "@daypicker/react/style.css";
import styles from "./schedule-calendar.module.css";

const firstDay = calendarDate("0001-01-01");
const lastDay = calendarDate("9999-12-31");

export function ScheduleCalendar({ date, today, path, children }: {
  date: string; today: string; path: SchedulePath; children: ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Month browsing is local; a committed URL date (including Back) takes precedence.
  const [browsing, setBrowsing] = useState({ forDate: date, month: date });
  if (browsing.forDate !== date) {
    setBrowsing({ forDate: date, month: date });
  }
  const month = browsing.forDate === date ? browsing.month : date;
  const previousDate = shiftScheduleDate(date, -1);
  const nextDate = shiftScheduleDate(date, 1);

  function navigate(next: string) {
    setBrowsing({ forDate: date, month: next });
    startTransition(() => router.push(scheduleDateHref(path, next), { scroll: false }));
  }

  return <div className={styles.workspace}>
    <aside className={styles.sidebar} aria-label="Вибір дати розкладу">
      <div className={styles.calendarHeading}>
        <strong><CalendarDays size={18} aria-hidden="true" /> Календар</strong>
        <button type="button" className={styles.todayButton} disabled={pending}
          onClick={() => navigate(getDateKeyInTimeZone(new Date()))}>Сьогодні</button>
      </div>
      <div className={styles.calendarScroll}>
        <DayPicker
          className={styles.calendar}
          mode="single"
          required
          locale={uk}
          timeZone="UTC"
          weekStartsOn={1}
          today={calendarDate(today)}
          selected={calendarDate(date)}
          month={calendarDate(month)}
          startMonth={firstDay}
          endMonth={lastDay}
          navLayout="around"
          showOutsideDays
          fixedWeeks
          disableNavigation={pending}
          disabled={pending ? true : [{ before: firstDay }, { after: lastDay }]}
          onMonthChange={(next) => {
            const key = calendarDateKey(next);
            if (key) setBrowsing({ forDate: date, month: key });
          }}
          onSelect={(next) => {
            const key = calendarDateKey(next);
            if (key) navigate(key);
          }}
          aria-label="Календар розкладу занять"
        />
      </div>
      <div className={styles.legend} aria-label="Позначення календаря">
        <span><i className={styles.selectedDot} aria-hidden="true" />Вибраний день</span>
        <span><i className={styles.todayDot} aria-hidden="true" />Сьогодні</span>
      </div>
      <div className={styles.dayNavigation}>
        <button type="button" className={styles.iconButton} aria-label="Попередній день"
          disabled={pending || !previousDate} onClick={() => previousDate && navigate(previousDate)}>
          <ArrowLeft size={18} aria-hidden="true" />
        </button>
        <time dateTime={date}>{formatScheduleDate(date)}</time>
        <button type="button" className={styles.iconButton} aria-label="Наступний день"
          disabled={pending || !nextDate} onClick={() => nextDate && navigate(nextDate)}>
          <ArrowRight size={18} aria-hidden="true" />
        </button>
      </div>
      <p className={styles.hint}>Виберіть день — розклад оновиться автоматично.</p>
      <div className={styles.loading} role="status" aria-live="polite">
        {pending && <><LoaderCircle size={16} className={styles.spinner} aria-hidden="true" /> Завантаження розкладу…</>}
      </div>
      <noscript><form action={path} method="get" className={styles.fallback}>
        <label>Дата розкладу<input name="date" type="date" defaultValue={date} min="0001-01-01" max="9999-12-31" required /></label>
        <button className="button button-light" type="submit">Перейти до дати</button>
      </form></noscript>
    </aside>
    <div className={styles.content} aria-busy={pending} data-loading={pending || undefined}>{children}</div>
  </div>;
}
