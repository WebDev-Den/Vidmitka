import { connection } from "next/server";

import { DayTimeline } from "@/components/day-timeline";
import { listClassPeriods, type ClassPeriod } from "@/lib/class-periods/repository";

export function DayTimelineMessage({ children }: { children: React.ReactNode }) {
  return (
    <section className="day-timeline day-timeline-message" aria-label="Сітка пар">
      <strong>Сітка пар</strong>
      <p className="day-timeline-status" role="status">{children}</p>
    </section>
  );
}

export async function PublicDayTimeline() {
  await connection();
  let periods: ClassPeriod[];
  try {
    periods = await listClassPeriods({ activeOnly: true });
  } catch {
    return <DayTimelineMessage>Не вдалося завантажити сітку пар. Спробуйте оновити сторінку.</DayTimelineMessage>;
  }

  return <DayTimeline initialNow={Date.now()} periods={periods.map(({ id, number, startMinute, endMinute, isActive, color }) => ({
    id, number, startMinute, endMinute, isActive, color,
  }))} />;
}
