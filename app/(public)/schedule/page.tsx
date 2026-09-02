import type { Metadata } from "next";

import { PublicHeader } from "@/components/public-header";
import { PublicScheduleExplorer } from "@/components/public-schedule-explorer";
import { getDateKeyInTimeZone } from "@/lib/schedule-week/rules";
import {
  getPublicScheduleDay,
  listPublicPeriods,
  listPublicTeachers,
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
  searchParams: Promise<{
    date?: string | string[];
    teacher?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const date = normalizeDate(typeof params.date === "string" ? params.date : undefined);
  const requestedTeacherId = typeof params.teacher === "string" ? params.teacher : "";
  const [teachers, periods, schedule] = await Promise.all([
    listPublicTeachers(),
    listPublicPeriods(),
    getPublicScheduleDay({ date, groupId: null, teacherId: requestedTeacherId || null }).then((day) => [day]),
  ]);
  const selectedTeacherId = teachers.some((teacher) => teacher.id === requestedTeacherId)
    ? requestedTeacherId
    : "";
  return (
    <>
      <div className="public-header-surface">
        <PublicHeader />
      </div>
      <PublicScheduleExplorer
        periods={periods}
        days={schedule}
        navigationDays={navigationWeek(date)}
        selectedDate={date}
        selectedTeacherId={selectedTeacherId}
        teachers={teachers}
      />
    </>
  );
}
