import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { Brand } from "@/components/brand";
import { DayTimelineMessage, PublicDayTimeline } from "@/components/public-day-timeline";
import { PublicNavigation } from "@/components/public-navigation";
import { getOptionalAppUser } from "@/lib/auth/session";

export async function PublicHeader() {
  const user = await getOptionalAppUser();

  return (
    <header className="public-header">
      <div className="public-header-inner">
        <Brand />
        <PublicNavigation />
        <Link
          className="button button-light header-action"
          href={user ? "/dashboard" : "/sign-in"}
        >
          {user ? "Відкрити кабінет" : "Увійти"}
          <ArrowUpRight size={17} />
        </Link>
      </div>
      <Suspense fallback={<DayTimelineMessage>Завантажуємо сітку пар…</DayTimelineMessage>}>
        <PublicDayTimeline />
      </Suspense>
    </header>
  );
}
