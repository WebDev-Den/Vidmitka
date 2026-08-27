import type { Metadata } from "next";

import { ScheduleView } from "@/components/schedule-view";

export const metadata: Metadata = { title: "Загальний розклад" };

export default function PrivateSchedulePage() {
  return <ScheduleView privateView />;
}
