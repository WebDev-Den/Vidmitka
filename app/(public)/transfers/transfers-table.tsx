import Link from "next/link";

import { ManagementTable } from "@/components/private/management-table";
import {
  calendarDayLabel,
  calendarWeekLabel,
} from "@/lib/schedule-v2/calendar-override-rules";
import { listCalendarOverrides } from "@/lib/schedule-v2/calendar-overrides";
import { listScheduleExceptions } from "@/lib/schedule-v2/exceptions";

const LABELS: Record<string, string> = { move: "Перенесення", reschedule: "Зміна дати або часу",
  room_change: "Зміна аудиторії", teacher_change: "Заміна викладача", discipline_change: "Заміна дисципліни",
  type_change: "Зміна типу заняття", cancel: "Скасування" };

export async function TransfersTable() {
  let calendarOverrides;
  let changes;
  try {
    [calendarOverrides, changes] = await Promise.all([
      listCalendarOverrides(),
      listScheduleExceptions().then((items) => items.filter((item) => item.status === "active" && item.kind !== "one_time")),
    ]);
  } catch {
    return <p className="notice" role="alert">
      Не вдалося завантажити перенесення пар. Спробуйте оновити сторінку.
    </p>;
  }

  return <div className="management-section-stack">
    <section className="management-section" aria-labelledby="calendar-transfers-heading">
      <div className="management-section-heading">
        <h2 id="calendar-transfers-heading">Календар перенесень</h2>
        <p>У зазначені дати діє розклад вибраного дня та типу навчального тижня.</p>
      </div>
      <ManagementTable caption="Календар перенесень навчальних днів" minWidth={640}
        columns={["Дата", "За розкладом дня", "Тип тижня", "Розклад"]}>
        <tbody>
          {calendarOverrides.length === 0 ? <tr><td colSpan={4}>
            <p className="management-description">Перенесень навчальних днів ще немає.</p>
          </td></tr> : null}
          {calendarOverrides.map((item) => <tr key={item.date}>
            <th scope="row"><time dateTime={item.date}>{item.date.split("-").reverse().join(".")}</time></th>
            <td>{calendarDayLabel(item.dayOfWeek)}</td>
            <td><span className="management-status is-active">{calendarWeekLabel(item.weekType)}</span></td>
            <td><Link className="button button-light" href={`/schedule?date=${encodeURIComponent(item.date)}`}>Переглянути</Link></td>
          </tr>)}
        </tbody>
      </ManagementTable>
    </section>

    {changes.length ? <section className="management-section" aria-labelledby="lesson-transfers-heading">
      <div className="management-section-heading">
        <h2 id="lesson-transfers-heading">Окремі зміни занять</h2>
        <p>Перенесення, заміни та скасування для конкретних занять.</p>
      </div>
      <ManagementTable caption="Окремі зміни занять" minWidth={760}
        columns={["Початкова дата", "Тип зміни", "Заняття", "Нова дата", "Причина", "Розклад"]}>
        <tbody>{changes.map((item) => {
          const dateLabel = item.originalDate.split("-").reverse().join(".");
          return <tr key={item.id}>
            <th scope="row"><time dateTime={item.originalDate}>{dateLabel}</time></th>
            <td><span className="management-status">{LABELS[item.kind] ?? "Зміна"}</span></td>
            <td>{item.baseLabel ?? "Разове заняття"}</td>
            <td>{item.newDate ? <time dateTime={item.newDate}>{item.newDate.split("-").reverse().join(".")}</time> : "—"}</td>
            <td>{item.reason || item.note || "—"}</td>
            <td><Link className="button button-light" href={`/schedule?date=${encodeURIComponent(item.newDate ?? item.originalDate)}`}>Переглянути</Link></td>
          </tr>;
        })}</tbody>
      </ManagementTable>
    </section> : null}
  </div>;
}
