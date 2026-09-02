import type { Metadata } from "next";

import { PublicHeader } from "@/components/public-header";
import { PublicScheduleExplorer } from "@/components/public-schedule-explorer";
import { getDateKeyInTimeZone } from "@/lib/schedule-week/rules";
import { getPublicScheduleDay, getPublicScheduleWeek, listPublicGroups } from "@/lib/schedule-v2/public-schedule";

export const metadata: Metadata = { title: "Публічний розклад" };

export default async function PublicSchedulePage({ searchParams }: {
  searchParams: Promise<{ date?: string | string[]; group?: string | string[]; view?: string | string[] }>;
}) {
  const params = await searchParams;
  const date = typeof params.date === "string" ? params.date : getDateKeyInTimeZone(new Date());
  const view = params.view === "week" ? "week" : "day";
  const groups = await listPublicGroups();
  const requestedGroup = typeof params.group === "string" ? params.group : "";
  const group = groups.some((item) => item.id === requestedGroup) ? requestedGroup : (groups[0]?.id ?? "");
  const schedule = await (view === "week"
    ? getPublicScheduleWeek({ date, groupId: group })
    : getPublicScheduleDay({ date, groupId: group }).then((day) => [day]));
  return (
    <>
      <div className="public-header-surface">
        <PublicHeader />
      </div>
      <PublicScheduleExplorer groups={groups} days={schedule} selectedGroupId={group} view={view} />
    </>
  );
}
