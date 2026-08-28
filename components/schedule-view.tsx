import { CalendarDays, CircleDot, Filter } from "lucide-react";

import { PageIntro } from "@/components/page-intro";
import { ScheduleDayNotice } from "@/components/schedule-day-notice";
import { formatMinute } from "@/lib/class-periods/rules";
import { LESSON_DAYS } from "@/lib/lessons/rules";
import { listScheduleForDate } from "@/lib/schedule-calendar/schedule";
import {
  formatWeekTypeLabel,
  getDateKeyInTimeZone,
  validateScheduleWeekSettings,
} from "@/lib/schedule-week/rules";

export async function ScheduleView({ privateView = false, selectedDate }: {
  privateView?: boolean; selectedDate?: string | string[];
}) {
  const validDate = typeof selectedDate === "string" && validateScheduleWeekSettings({ numeratorDate: selectedDate }).ok;
  const date = validDate ? selectedDate : getDateKeyInTimeZone(new Date());
  const { day, lessons } = await listScheduleForDate(date);
  const currentWeekType = day.weekType;

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

      {selectedDate !== undefined && !validDate && <p className="notice" role="alert">Некоректна дата. Показано сьогоднішній розклад.</p>}
      <form method="get" className="lesson-editor schedule-date-form" key={date}>
        <label>Дата розкладу
          <input name="date" type="date" defaultValue={date} min="0001-01-01" max="9999-12-31" required />
        </label>
        <button type="submit" className="button button-light">Показати розклад</button>
      </form>
      <ScheduleDayNotice day={day} />

      <div className="schedule-toolbar" aria-label="Фільтри розкладу">
        <div className="week-legend" aria-label="Типи навчального тижня">
          <span className={`week-chip${currentWeekType === "numerator" ? " is-active" : ""}`}>
            {currentWeekType === "numerator" ? <CircleDot size={14} /> : null}
            Чисельник
          </span>
          <span className={`week-chip${currentWeekType === "denominator" ? " is-active" : ""}`}>
            {currentWeekType === "denominator" ? <CircleDot size={14} /> : null}
            Знаменник
          </span>
          <span className="week-chip">Обидва тижні</span>
        </div>
        <div className="schedule-filter-note">
          <Filter size={16} />
          {currentWeekType
            ? `${LESSON_DAYS[day.dayOfWeek - 1]} · ${formatWeekTypeLabel(currentWeekType)}`
            : "Дату чисельника не налаштовано — показано лише заняття обох тижнів"}
        </div>
      </div>

      <div className="schedule-table-wrap">
        <table className="schedule-table daily-schedule-table">
          <thead>
            <tr>
              <th scope="col">Дата</th>
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
                  {day.isMakeup && <span className="week-chip is-active">Відпрацювання</span>}
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
                  <strong>На цю дату занять немає</strong>
                  <p>
                    Оберіть іншу дату. Створені заняття з’являються тут відповідно до дня розкладу та типу тижня.
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
