import type { Metadata } from "next";

import { ScheduleView } from "@/components/schedule-view";

export const metadata: Metadata = { title: "Загальний розклад" };

export default async function PrivateSchedulePage({ searchParams }: {
  searchParams: Promise<{ date?: string | string[] }>;
}) {
  const { date } = await searchParams;
  return <ScheduleView privateView selectedDate={date} />;
}
