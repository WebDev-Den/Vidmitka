import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";

import { ManagementTable } from "@/components/private/management-table";
import { LESSON_DAYS } from "@/lib/lessons/rules";
import { scheduleDateHref } from "@/lib/schedule-calendar/presentation";
import { listPublicMakeupDays } from "@/lib/schedule-calendar/repository";
import type { PublicMakeupDay } from "@/lib/schedule-calendar/rules";
import { formatWeekTypeLabel } from "@/lib/schedule-week/rules";

export async function TransfersTable() {
  await connection();
  let days: PublicMakeupDay[];
  try {
    days = await listPublicMakeupDays();
  } catch {
    return <p className="notice" role="alert">
      Не вдалося завантажити перенесення пар. Спробуйте оновити сторінку.
    </p>;
  }

  return <ManagementTable caption="Календар перенесення пар" minWidth={600}
    columns={["Дата відпрацювання", "За розкладом дня", "Тип тижня", "Розклад"]}>
    <tbody>
      {days.length === 0 && <tr><td colSpan={4}>
        <p className="management-description">Перенесень пар ще немає. Тут з’являться дати, додані адміністратором.</p>
      </td></tr>}
      {days.map((day) => {
        const dateLabel = day.date.split("-").reverse().join(".");
        return <tr key={day.date}>
          <th scope="row"><time dateTime={day.date}>{dateLabel}</time></th>
          <td>{LESSON_DAYS[day.dayOfWeek - 1]}</td>
          <td><span className="management-status">{formatWeekTypeLabel(day.weekType)}</span></td>
          <td className="management-actions-cell">
            <Link className="button button-light" href={scheduleDateHref("/schedule", day.date)}
              aria-label={`Переглянути розклад на ${dateLabel}`}>
              Переглянути <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </td>
        </tr>;
      })}
    </tbody>
  </ManagementTable>;
}
