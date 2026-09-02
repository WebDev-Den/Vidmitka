import { PageIntro } from "@/components/page-intro";
import { ExceptionManager } from "@/components/private/exception-manager";
import { listScheduleEntries } from "@/lib/schedule-v2/entries";
import { listScheduleExceptions } from "@/lib/schedule-v2/exceptions";
import { getScheduleEditorOptions } from "@/lib/schedule-v2/options";

import { manageScheduleExceptionAction } from "./actions";

export default async function ExceptionsPage() {
  const [exceptions, entries, options] = await Promise.all([listScheduleExceptions(), listScheduleEntries(), getScheduleEditorOptions({ activeOnly: false })]);
  return <section className="management-page"><PageIntro eyebrow="РОЗКЛАД" title="Переноси та винятки"
    description="Разові зміни накладаються на базовий розклад і не змінюють його повторювані записи." />
    <ExceptionManager exceptions={exceptions} entries={entries} options={options} action={manageScheduleExceptionAction} /></section>;
}
