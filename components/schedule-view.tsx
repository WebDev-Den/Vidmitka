import { CalendarDays, CircleDot, Filter } from "lucide-react";

import { PageIntro } from "@/components/page-intro";
import { getScheduleWeekSettings } from "@/lib/schedule-week/repository";
import {
  formatWeekTypeLabel,
  getDateKeyInTimeZone,
  getWeekTypeForDate,
} from "@/lib/schedule-week/rules";

export async function ScheduleView({ privateView = false }: { privateView?: boolean }) {
  const settings = await getScheduleWeekSettings();
  const currentWeekType = settings
    ? getWeekTypeForDate(getDateKeyInTimeZone(new Date()), settings)
    : null;

  return (
    <section className="schedule-view">
      <PageIntro
        eyebrow={privateView ? "РОБОЧИЙ ПРОСТІР" : "ПУБЛІЧНИЙ ДОСТУП"}
        title={privateView ? "Загальний розклад" : "Розклад занять"}
        description={
          privateView
            ? "Переглядайте опубліковані заняття всіх викладачів і аудиторій."
            : "Актуальний тижневий розклад без необхідності входу в систему."
        }
      />

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
            ? `Поточний тиждень: ${formatWeekTypeLabel(currentWeekType)}`
            : "Адміністратор ще не налаштував чергування тижнів"}
        </div>
      </div>

      <div className="schedule-table-wrap">
        <table className="schedule-table">
          <thead>
            <tr>
              <th>День</th>
              <th>Пара</th>
              <th>Предмет</th>
              <th>Викладач</th>
              <th>Аудиторія</th>
              <th>Тиждень</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="schedule-empty" colSpan={6}>
                <div className="schedule-empty-content">
                  <span className="empty-icon" aria-hidden="true">
                    <CalendarDays size={24} />
                  </span>
                  <strong>Розклад ще не опубліковано</strong>
                  <p>
                    Після створення першого заняття воно з’явиться тут
                    автоматично.
                  </p>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
