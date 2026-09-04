"use client";

import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";

import { PUBLIC_DATE_HANDOFF_STORAGE } from "@/lib/schedule-v2/public-schedule-state";

export function PublicScheduleDateLink({
  children,
  className,
  date,
}: {
  children: ReactNode;
  className?: string;
  date: string;
}) {
  function rememberDate(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    try {
      window.sessionStorage.setItem(PUBLIC_DATE_HANDOFF_STORAGE, date);
    } catch {
      // Navigation still works when browser storage is unavailable.
    }
  }

  return <Link className={className} href="/" onClick={rememberDate}>{children}</Link>;
}
