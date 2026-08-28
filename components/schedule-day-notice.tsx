import { CalendarDays } from "lucide-react";
import { LESSON_DAYS } from "@/lib/lessons/rules";
import type { ScheduleDayContext } from "@/lib/schedule-calendar/rules";
import { formatWeekTypeLabel } from "@/lib/schedule-week/rules";

export function ScheduleDayNotice({ day }: { day: ScheduleDayContext }) {
  if (!day.isMakeup) return null;
  return (
    <div className="notice" role="note" aria-label="Відпрацювання">
      <CalendarDays size={22} aria-hidden="true" />
      <p>
        <strong>Відпрацювання · {day.date.split("-").reverse().join(".")}</strong><br />
        За розкладом: {LESSON_DAYS[day.dayOfWeek - 1]}
        {day.weekType ? ` · ${formatWeekTypeLabel(day.weekType)}` : ""}.
        {" "}Звичайний розклад цієї дати замінено.
      </p>
    </div>
  );
}
