import { PageIntro } from "@/components/page-intro";
import { PushOperationsManager } from "@/components/private/push-operations-manager";
import { getAdminPushDashboard } from "@/lib/public-push/admin-operations";

import { sendAdminPushAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminPushPage() {
  const dashboard = await getAdminPushDashboard();
  return <section className="management-page">
    <PageIntro
      eyebrow="ОПЕРАЦІЙНИЙ КОНТРОЛЬ"
      title="Push-сповіщення"
      description="Статус cron-запусків, активні пристрої та ручне відтворення найближчого повідомлення."
    />
    <PushOperationsManager dashboard={dashboard} action={sendAdminPushAction} />
  </section>;
}
