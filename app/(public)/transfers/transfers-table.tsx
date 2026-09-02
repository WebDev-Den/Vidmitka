import Link from "next/link";

import { ManagementTable } from "@/components/private/management-table";
import { listScheduleExceptions } from "@/lib/schedule-v2/exceptions";

const LABELS: Record<string, string> = { move: "Перенесення", reschedule: "Зміна дати або часу",
  room_change: "Зміна аудиторії", teacher_change: "Заміна викладача", discipline_change: "Заміна дисципліни",
  type_change: "Зміна типу заняття", cancel: "Скасування" };

export async function TransfersTable() {
  let changes;
  try {
    changes = (await listScheduleExceptions()).filter((item) => item.status === "active" && item.kind !== "one_time");
  } catch {
    return <p className="notice" role="alert">
      Не вдалося завантажити перенесення пар. Спробуйте оновити сторінку.
    </p>;
  }

  return <ManagementTable caption="Перенесення та зміни розкладу" minWidth={760}
    columns={["Початкова дата", "Тип зміни", "Заняття", "Нова дата", "Причина", "Розклад"]}>
    <tbody>
      {changes.length === 0 && <tr><td colSpan={6}>
        <p className="management-description">Активних переносів і замін немає.</p>
      </td></tr>}
      {changes.map((item) => {
        const dateLabel = item.originalDate.split("-").reverse().join(".");
        return <tr key={item.id}>
          <th scope="row"><time dateTime={item.originalDate}>{dateLabel}</time></th>
          <td><span className="management-status">{LABELS[item.kind] ?? "Зміна"}</span></td>
          <td>{item.baseLabel ?? "Разове заняття"}</td>
          <td>{item.newDate ? <time dateTime={item.newDate}>{item.newDate.split("-").reverse().join(".")}</time> : "—"}</td>
          <td>{item.reason || item.note || "—"}</td>
          <td><Link className="button button-light" href={`/schedule?date=${encodeURIComponent(item.newDate ?? item.originalDate)}`}>Переглянути</Link></td>
        </tr>;
      })}
    </tbody>
  </ManagementTable>;
}
