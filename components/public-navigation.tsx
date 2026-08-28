"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/schedule", label: "Розклад" },
  { href: "/transfers", label: "Перенесення пар" },
] as const;

function NavigationLabel({ label }: { label: string }) {
  const { pending } = useLinkStatus();
  return <>
    {label}
    <span className="public-navigation-indicator" aria-hidden="true">
      {pending && <span className="navigation-spinner" />}
    </span>
    <span className="sr-only" role="status" aria-atomic="true">
      {pending ? `Завантаження: ${label}…` : ""}
    </span>
  </>;
}

export function PublicNavigation() {
  const pathname = usePathname();
  return <nav className="public-navigation" aria-label="Публічна навігація">
    {links.map(({ href, label }) => <Link key={href} href={href}
      aria-current={pathname === href ? "page" : undefined}>
      <NavigationLabel label={label} />
    </Link>)}
  </nav>;
}
