import type { Metadata } from "next";

import { PublicHeader } from "@/components/public-header";
import { ScheduleView } from "@/components/schedule-view";

export const metadata: Metadata = { title: "Публічний розклад" };

export default function PublicSchedulePage() {
  return (
    <>
      <div className="public-header-surface">
        <PublicHeader />
      </div>
      <main className="public-content">
        <ScheduleView />
      </main>
    </>
  );
}
