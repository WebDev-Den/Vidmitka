"use client";

import { CircleDot } from "lucide-react";
import { useLinkStatus } from "next/link";

/** Render below Link so the hint follows the real navigation, not a timer. */
export function ScheduleWeekLinkContent({ label, active }: { label: string; active: boolean }) {
  const { pending } = useLinkStatus();
  return <>
    <span className="schedule-week-indicator" aria-hidden="true">
      {pending ? <span className="navigation-spinner" /> : active ? <CircleDot size={16} /> : null}
    </span>
    {label}
    <span className="sr-only" role="status" aria-atomic="true">{pending ? `Завантаження розкладу: ${label}…` : ""}</span>
  </>;
}
