import type { Metadata } from "next";

import { PublicHeader } from "@/components/public-header";
import { PublicScheduleExplorer } from "@/components/public-schedule-explorer";
import { getDateKeyInTimeZone } from "@/lib/schedule-week/rules";
import {
  getPublicScheduleDay,
  getPublicScheduleWeek,
  listPublicGroups,
  listPublicPeriods,
} from "@/lib/schedule-v2/public-schedule";

export const metadata: Metadata = { title: "Публічний розклад" };

function normalizeDate(value: string | undefined): string {
  const fallback = getDateKeyInTimeZone(new Date());
  if (!value || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return fallback;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : fallback;
}

function addDays(date: string, amount: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

function navigationWeek(date: string) {
  const value = new Date(`${date}T00:00:00Z`);
  const mondayOffset = (value.getUTCDay() + 6) % 7;
  const monday = addDays(date, -mondayOffset);
  return Array.from({ length: 7 }, (_, index) => {
    const itemDate = addDays(monday, index);
    const item = new Date(`${itemDate}T00:00:00Z`);
    return {
      date: itemDate,
      shortLabel: new Intl.DateTimeFormat("uk-UA", { weekday: "short", timeZone: "UTC" }).format(item),
      dayLabel: new Intl.DateTimeFormat("uk-UA", { day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(item),
    };
  });
}

export default async function PublicSchedulePage({ searchParams }: {
  searchParams: Promise<{ date?: string | string[]; group?: string | string[]; view?: string | string[] }>;
}) {
  const params = await searchParams;
  const date = normalizeDate(typeof params.date === "string" ? params.date : undefined);
  const view = params.view === "week" ? "week" : "day";
  const [groups, periods] = await Promise.all([listPublicGroups(), listPublicPeriods()]);
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
      <PublicScheduleExplorer
        groups={groups}
        periods={periods}
        days={schedule}
        navigationDays={navigationWeek(date)}
        selectedDate={date}
        selectedGroupId={group}
        view={view}
      />
    </>
  );
}
