import { CalendarDays, CircleDot, Filter } from "lucide-react";

import { PageIntro } from "@/components/page-intro";

export function ScheduleView({ privateView = false }: { privateView?: boolean }) {
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
          <span className="week-chip is-active">
            <CircleDot size={14} /> Чисельник
          </span>
          <span className="week-chip">Знаменник</span>
          <span className="week-chip">Обидва тижні</span>
        </div>
        <div className="schedule-filter-note">
          <Filter size={16} /> Фільтри стануть доступними після додавання довідників
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
