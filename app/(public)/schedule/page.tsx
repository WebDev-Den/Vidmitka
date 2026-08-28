import type { Metadata } from "next";

import { PublicHeader } from "@/components/public-header";
import { ScheduleView } from "@/components/schedule-view";

export const metadata: Metadata = { title: "Публічний розклад" };

export default async function PublicSchedulePage({ searchParams }: {
  searchParams: Promise<{ date?: string | string[]; week?: string | string[] }>;
}) {
  const { date, week } = await searchParams;
  return (
    <>
      <div className="public-header-surface">
        <PublicHeader />
      </div>
      <main className="public-content">
        <ScheduleView selectedDate={date} selectedWeek={week} />
      </main>
    </>
  );
}
