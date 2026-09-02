import { PageIntro } from "@/components/page-intro";
import { CalendarOverrideManager } from "@/components/private/calendar-override-manager";
import { ExceptionManager } from "@/components/private/exception-manager";
import { listCalendarOverrides } from "@/lib/schedule-v2/calendar-overrides";
import { listScheduleEntries } from "@/lib/schedule-v2/entries";
import { listScheduleExceptions } from "@/lib/schedule-v2/exceptions";
import { getScheduleEditorOptions } from "@/lib/schedule-v2/options";

import { manageCalendarOverrideAction, manageScheduleExceptionAction } from "./actions";

export default async function ExceptionsPage() {
  const [calendarOverrides, exceptions, entries, options] = await Promise.all([
    listCalendarOverrides(),
    listScheduleExceptions(),
    listScheduleEntries(),
    getScheduleEditorOptions({ activeOnly: false }),
  ]);
  return <section className="management-page"><PageIntro eyebrow="РОЗКЛАД" title="Переноси та винятки"
    description="Змініть розклад усього навчального дня або додайте виняток для окремого заняття." />
    <CalendarOverrideManager items={calendarOverrides} action={manageCalendarOverrideAction} />
    <div className="management-section-heading">
      <h2>Окремі зміни занять</h2>
      <p>Разові зміни накладаються на базовий розклад і не змінюють його повторювані записи.</p>
    </div>
    <ExceptionManager exceptions={exceptions} entries={entries} options={options} action={manageScheduleExceptionAction} /></section>;
}
