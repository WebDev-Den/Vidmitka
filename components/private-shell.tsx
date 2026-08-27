"use client";

import { UserButton } from "@clerk/nextjs";
import {
  BookOpen,
  Building2,
  CalendarDays,
  ChevronRight,
  CircleUserRound,
  LayoutDashboard,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings2,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Brand } from "@/components/brand";
import type { AppUser } from "@/lib/auth/session";
import {
  getRoleNavigation,
  type NavigationIcon,
} from "@/lib/navigation/role-navigation";

const iconByName: Record<NavigationIcon, LucideIcon> = {
  overview: LayoutDashboard,
  schedule: CalendarDays,
  lessons: BookOpen,
  create: Plus,
  teachers: UsersRound,
  subjects: BookOpen,
  rooms: Building2,
  profile: CircleUserRound,
  settings: Settings2,
};

export function PrivateShell({
  user,
  children,
}: {
  user: AppUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigation = useMemo(() => getRoleNavigation(user.role), [user.role]);
  const activeItem =
    navigation.find(
      (item) =>
        pathname === item.href ||
        (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`)),
    ) ?? navigation[0];

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  return (
    <div
      className={`private-shell${collapsed ? " is-collapsed" : ""}${
        mobileOpen ? " is-mobile-open" : ""
      }`}
    >
      <aside className="private-sidebar" aria-label="Навігація кабінету">
        <div className="private-brand-row">
          <Brand compact={collapsed} />
          <button
            className="icon-control desktop-collapse"
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? "Розгорнути меню" : "Згорнути меню ліворуч"}
            aria-expanded={!collapsed}
          >
            {collapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
          </button>
          <button
            className="icon-control mobile-close"
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Закрити меню"
          >
            <X size={20} />
          </button>
        </div>

        <div className="role-caption">
          <span>{user.roleLabel}</span>
          <small>{user.role === "administrator" ? "Керування системою" : "Робочий простір"}</small>
        </div>

        <nav className="role-navigation" aria-label={`Меню ролі ${user.roleLabel}`}>
          {navigation.map((item) => {
            const Icon = iconByName[item.icon];
            const active =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));

            return (
              <Link
                key={item.id}
                className={active ? "role-link is-active" : "role-link"}
                href={item.href}
                aria-current={active ? "page" : undefined}
                title={collapsed ? item.label : undefined}
              >
                <Icon size={19} />
                <span>{item.label}</span>
                {!collapsed && active && <ChevronRight size={16} />}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-user">
          <span className="user-initials">{user.initials}</span>
          <span className="sidebar-user-copy">
            <strong>{user.name}</strong>
            <small>{user.email}</small>
          </span>
        </div>
      </aside>

      <button
        className="mobile-backdrop"
        type="button"
        onClick={() => setMobileOpen(false)}
        aria-label="Закрити меню"
        tabIndex={mobileOpen ? 0 : -1}
      />

      <div className="private-workspace">
        <header className="private-topbar">
          <button
            className="icon-control mobile-menu-button"
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Відкрити меню"
            aria-expanded={mobileOpen}
          >
            <Menu size={21} />
          </button>
          <div className="topbar-title">
            <span>{user.roleLabel}</span>
            <strong>{activeItem?.label ?? "Кабінет"}</strong>
          </div>
          <div className="topbar-actions">
            <span className={`role-badge role-${user.role}`}>{user.roleLabel}</span>
            <UserButton
              appearance={{ elements: { avatarBox: "clerk-avatar" } }}
            />
          </div>
        </header>
        <main className="private-content">{children}</main>
      </div>
    </div>
  );
}
