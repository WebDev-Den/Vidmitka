"use client";

import { ChevronRight, type LucideIcon } from "lucide-react";
import { useLinkStatus } from "next/link";

/** Must stay below Link so pending follows the router's actual transition. */
export function NavigationLinkContent({ icon: Icon, label, active }: {
  icon: LucideIcon;
  label: string;
  active: boolean;
}) {
  const { pending } = useLinkStatus();

  return <>
    <span className="role-link-icon" data-pending={pending || undefined} aria-hidden="true">
      {pending ? <span className="navigation-spinner" /> : <Icon size={19} />}
    </span>
    <span className="role-link-label">{label}</span>
    {active && <ChevronRight className="role-link-chevron" size={16} aria-hidden="true" />}
    <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {pending ? `Завантаження розділу «${label}»…` : ""}
    </span>
  </>;
}
