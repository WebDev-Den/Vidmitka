import { CalendarDays, Filter } from "lucide-react";
import Link from "next/link";

import { PageIntro } from "@/components/page-intro";
import { ScheduleDayNotice } from "@/components/schedule-day-notice";
import { ScheduleWeekLinkContent } from "@/components/schedule-week-link-content";
import { formatMinute } from "@/lib/class-periods/rules";
import { LESSON_DAYS } from "@/lib/lessons/rules";
import { listScheduleForDate } from "@/lib/schedule-calendar/schedule";
import { scheduleWeekHref } from "@/lib/schedule-calendar/view";
import {
  formatWeekTypeLabel,
  getDateKeyInTimeZone,
  validateScheduleWeekSettings,
} from "@/lib/schedule-week/rules";

export async function ScheduleView({ privateView = false, selectedDate, selectedWeek }: {
  privateView?: boolean; selectedDate?: string | string[]; selectedWeek?: string | string[];
}) {
  const validDate = typeof selectedDate === "string" && validateScheduleWeekSettings({ numeratorDate: selectedDate }).ok;
  const date = validDate ? selectedDate : getDateKeyInTimeZone(new Date());
  const { day, view, lessons } = await listScheduleForDate(date, selectedWeek);
  const currentWeekType = view.weekType;
  const path = privateView ? "/dashboard/schedule" : "/schedule";

  return (
    <section className="schedule-view">
      <PageIntro
        eyebrow={privateView ? "РОБОЧИЙ ПРОСТІР" : "ПУБЛІЧНИЙ ДОСТУП"}
        title={privateView ? "Загальний розклад" : "Розклад занять"}
        description={
          privateView
            ? "Переглядайте опубліковані заняття всіх викладачів і аудиторій."
            : "Актуальні заняття на обрану дату без необхідності входу в систему."
        }
      />

      {selectedDate !== undefined && !validDate && <p className="notice" role="alert">Некоректна дата. Використано сьогоднішню дату.</p>}
      {view.invalidWeek && <p className="notice" role="alert">Некоректний тип тижня. Показано розклад за календарем вибраної дати.</p>}
      <form method="get" className="lesson-editor schedule-date-form" key={date}>
        <label>Дата розкладу
          <input name="date" type="date" defaultValue={date} min="0001-01-01" max="9999-12-31" required />
        </label>
        <button type="submit" className="button button-light">Показати розклад</button>
      </form>
      <ScheduleDayNotice day={day} />
      {view.isPreview && currentWeekType && <div className="notice" role="note"><p>
        <strong>Попередній перегляд · {formatWeekTypeLabel(currentWeekType)}.</strong>{" "}
        Показано варіант для дня «{LESSON_DAYS[day.dayOfWeek - 1]}». {day.weekType
          ? `За календарем цієї дати — ${formatWeekTypeLabel(day.weekType)}.`
          : "Дату чисельника ще не налаштовано."}{" "}
        Це не змінює календар або журнал. Щоб повернутися до календарного розкладу, натисніть «Показати розклад».
      </p></div>}

      <div className="schedule-toolbar" aria-label="Фільтри розкладу">
        <nav className="week-legend" aria-label="Перегляд типу навчального тижня">
          {(["numerator", "denominator"] as const).map((week) => <Link key={week}
            href={scheduleWeekHref(path, date, week)} scroll={false}
            className={`week-chip schedule-week-link${currentWeekType === week ? " is-active" : ""}`}
            aria-current={currentWeekType === week ? "true" : undefined}
            aria-label={`Показати розклад: ${formatWeekTypeLabel(week)}`}>
            <ScheduleWeekLinkContent label={formatWeekTypeLabel(week)} active={currentWeekType === week} />
          </Link>)}
        </nav>
        <div className="schedule-filter-note">
          <Filter size={16} aria-hidden="true" />
          {currentWeekType
            ? `${LESSON_DAYS[day.dayOfWeek - 1]} · ${formatWeekTypeLabel(currentWeekType)}${view.isPreview ? " · Перегляд" : ""}`
            : "Дату чисельника не налаштовано — показано лише щотижневі заняття. Оберіть тип для перегляду."}
        </div>
      </div>

      <div className="schedule-table-wrap">
        <table className="schedule-table daily-schedule-table">
          <thead>
            <tr>
              <th scope="col">{view.isPreview ? "Дата-орієнтир" : "Дата"}</th>
              <th scope="col">Пара</th>
              <th scope="col">Предмет / тип / групи</th>
              <th scope="col">Викладач</th>
              <th scope="col">Аудиторія</th>
              <th scope="col">Тиждень</th>
            </tr>
          </thead>
          <tbody>
            {lessons.length ? lessons.map((lesson) => (
              <tr key={lesson.id}>
                <td>{date.split("-").reverse().join(".")}<small>{LESSON_DAYS[day.calendarDayOfWeek - 1]}</small>
                  {view.isPreview ? <span className="week-chip">Перегляд</span>
                    : day.isMakeup && <span className="week-chip is-active">Відпрацювання</span>}
                </td>
                <td><strong>{lesson.periodNumber} пара</strong><small>{formatMinute(lesson.startMinute)}–{formatMinute(lesson.endMinute)}</small></td>
                <td><strong>{lesson.subjectName}</strong><small>{lesson.lessonTypeName ?? "Тип не вказано"}</small><small>{lesson.groupNames.join(", ") || "Групи не вказані"}</small></td>
                <td>{lesson.teacherName}</td>
                <td>{lesson.roomName}</td>
                <td>{lesson.weekType === "both" ? "Обидва тижні" : formatWeekTypeLabel(lesson.weekType)}</td>
              </tr>
            )) : <tr>
              <td className="schedule-empty" colSpan={6}>
                <div className="schedule-empty-content">
                  <span className="empty-icon" aria-hidden="true">
                    <CalendarDays size={24} />
                  </span>
                  <strong>{view.isPreview ? "Для цього дня й типу тижня занять немає" : "На цю дату занять немає"}</strong>
                  <p>
                    Оберіть іншу дату або перемкніть тип тижня. Щотижневі заняття показуються і за чисельником, і за знаменником.
                  </p>
                </div>
              </td>
            </tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
