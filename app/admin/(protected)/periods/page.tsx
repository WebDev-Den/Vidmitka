import { PageIntro } from "@/components/page-intro";
import { PeriodManager } from "@/components/private/period-manager";
import { listClassPeriods } from "@/lib/class-periods/repository";

export default async function PeriodsPage() {
  return <section className="management-page"><PageIntro eyebrow="ДОВІДНИКИ" title="Пари та час"
    description="Керуйте номерами, часом і кольорами пар. Неактивні пари не можна призначити новому заняттю." />
    <PeriodManager periods={await listClassPeriods()} /></section>;
}
