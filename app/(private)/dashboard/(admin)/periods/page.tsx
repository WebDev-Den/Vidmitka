import { PageIntro } from "@/components/page-intro";
import { listClassPeriods } from "@/lib/class-periods/repository";

import { PeriodManager } from "./period-manager";

export default async function PeriodsPage() {
  const periods = await listClassPeriods();

  return (
    <section>
      <PageIntro
        eyebrow="ДОВІДНИКИ"
        title="Пари та час"
        description="Керуйте номерами пар і точними межами навчальних слотів. Неактивні пари залишаються в переліку, але їх не можна вибрати для нового заняття."
      />
      <PeriodManager
        periods={periods.map(
          ({ id, number, startTime, endTime, isActive }) => ({
            id,
            number,
            startTime,
            endTime,
            isActive,
          }),
        )}
      />
    </section>
  );
}
