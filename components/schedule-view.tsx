import Link from "next/link";

import { PageIntro } from "@/components/page-intro";
import { ScheduleAgenda } from "@/components/schedule-agenda";
import { ScheduleCalendar } from "@/components/schedule-calendar";
import { ScheduleDayNotice } from "@/components/schedule-day-notice";
import { ScheduleWeekLinkContent } from "@/components/schedule-week-link-content";
import { LESSON_DAYS } from "@/lib/lessons/rules";
import { formatScheduleDate, scheduleDateHref } from "@/lib/schedule-calendar/presentation";
import { listScheduleForDate } from "@/lib/schedule-calendar/schedule";
import { scheduleWeekHref } from "@/lib/schedule-calendar/view";
import {
  formatWeekTypeLabel,
  getDateKeyInTimeZone,
  validateScheduleWeekSettings,
} from "@/lib/schedule-week/rules";
import styles from "./schedule-calendar.module.css";

export async function ScheduleView({ privateView = false, selectedDate, selectedWeek }: {
  privateView?: boolean; selectedDate?: string | string[]; selectedWeek?: string | string[];
}) {
  const today = getDateKeyInTimeZone(new Date());
  const parsedDate = typeof selectedDate === "string"
    ? validateScheduleWeekSettings({ numeratorDate: selectedDate }) : null;
  const validDate = parsedDate?.ok === true;
  const date = parsedDate?.ok ? parsedDate.value.anchorDate : today;
  const { day, view, lessons } = await listScheduleForDate(date, selectedWeek);
  const currentWeekType = view.weekType;
  const path = privateView ? "/dashboard/schedule" : "/schedule";

  return (
    <section className={styles.root}>
      <PageIntro
        eyebrow={privateView ? "РОБОЧИЙ ПРОСТІР" : "ПУБЛІЧНИЙ ДОСТУП"}
        title={privateView ? "Загальний розклад" : "Розклад занять"}
        description="Оберіть день у календарі, щоб переглянути заняття, викладачів та аудиторії."
      />
      {selectedDate !== undefined && !validDate && <p className={styles.notice} role="alert">Некоректна дата. Використано сьогоднішню дату.</p>}
      {view.invalidWeek && <p className={styles.notice} role="alert">Некоректний тип тижня. Показано розклад за календарем вибраної дати.</p>}

      <ScheduleCalendar date={date} today={today} path={path}>
        <header className={styles.dayHeading}>
          <div>
            <p>{LESSON_DAYS[day.calendarDayOfWeek - 1]}{view.isPreview ? " · Дата-орієнтир" : date === today ? " · Сьогодні" : ""}</p>
            <h2><time dateTime={date}>{formatScheduleDate(date)}</time></h2>
          </div>
          <span className={styles.count}>Занять: {lessons.length}</span>
        </header>
        <div className={styles.toolbar} aria-label="Фільтри розкладу">
          <nav aria-label="Перегляд типу навчального тижня">
            {(["numerator", "denominator"] as const).map((week) => <Link key={week}
              href={scheduleWeekHref(path, date, week)} scroll={false}
              className={`week-chip schedule-week-link${currentWeekType === week ? " is-active" : ""}`}
              aria-current={currentWeekType === week ? "true" : undefined}
              aria-label={`Показати розклад: ${formatWeekTypeLabel(week)}`}>
              <ScheduleWeekLinkContent label={formatWeekTypeLabel(week)} active={currentWeekType === week} />
            </Link>)}
          </nav>
          {view.isPreview && <Link className={styles.calendarLink} href={scheduleDateHref(path, date)} scroll={false}>
            <ScheduleWeekLinkContent label="За календарем" active={false} />
          </Link>}
        </div>

        <ScheduleDayNotice day={day} />
        {view.isPreview && currentWeekType && <div className={styles.notice} role="note"><p>
          <strong>Попередній перегляд · {formatWeekTypeLabel(currentWeekType)}.</strong>{" "}
          За розкладом дня «{LESSON_DAYS[day.dayOfWeek - 1]}». {day.weekType
            ? `За календарем цієї дати — ${formatWeekTypeLabel(day.weekType)}.`
            : "Дату чисельника ще не налаштовано."}{" "}
          Календар і журнал не змінюються. Поверніться до фактичного розкладу кнопкою «За календарем».
        </p></div>}
        {!currentWeekType && <p className={styles.notice}>
          Дату чисельника ще не налаштовано — показано лише щотижневі заняття.
          Оберіть чисельник або знаменник для попереднього перегляду.
        </p>}

        <ScheduleAgenda lessons={lessons} isPreview={view.isPreview} />
      </ScheduleCalendar>
    </section>
  );
}
