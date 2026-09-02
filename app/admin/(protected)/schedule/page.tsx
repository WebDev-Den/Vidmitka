import { PageIntro } from "@/components/page-intro";
import { ScheduleManager } from "@/components/private/schedule-manager";
import { listScheduleEntries } from "@/lib/schedule-v2/entries";
import { getScheduleEditorOptions } from "@/lib/schedule-v2/options";

import { manageScheduleEntryAction } from "./actions";

export default async function AdminSchedulePage() {
  const [entries, options] = await Promise.all([listScheduleEntries(), getScheduleEditorOptions({ activeOnly: false })]);
  return <section className="management-page"><PageIntro eyebrow="РОЗКЛАД" title="Базовий розклад"
    description="Повторювані заняття. Разові переноси, заміни та скасування створюйте у розділі винятків." />
    <ScheduleManager entries={entries} options={options} action={manageScheduleEntryAction} /></section>;
}
