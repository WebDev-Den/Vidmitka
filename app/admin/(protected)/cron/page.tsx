import { PageIntro } from "@/components/page-intro";
import { getQStashSchedulerStatus } from "@/lib/public-push/qstash-schedules";

import { CronManager } from "./cron-manager";

export const dynamic = "force-dynamic";

export default async function CronPage() {
  const status = await getQStashSchedulerStatus();

  return <section className="management-page">
    <PageIntro
      eyebrow="АДМІНІСТРУВАННЯ"
      title="Push cron"
      description="Статус і керування запланованими QStash-запусками для сповіщень."
    />
    <CronManager status={status} />
  </section>;
}
