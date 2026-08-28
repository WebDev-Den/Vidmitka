"use client";

import {
  BookOpen,
  Building2,
  CalendarDays,
  Clock3,
  ChevronRight,
  CircleUserRound,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings2,
  Upload,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { Brand } from "@/components/brand";
import { signOutAction } from "@/app/(auth)/actions";
import type { AppUser } from "@/lib/auth/session";
import {
  getRoleNavigation,
  type NavigationIcon,
} from "@/lib/navigation/role-navigation";

const iconByName: Record<NavigationIcon, LucideIcon> = {
  overview: LayoutDashboard,
  schedule: CalendarDays,
  lessons: BookOpen,
  import: Upload,
  create: Plus,
  teachers: UsersRound,
  subjects: BookOpen,
  rooms: Building2,
  periods: Clock3,
  students: GraduationCap,
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
  const sidebarRef = useRef<HTMLElement>(null);
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileCloseRef = useRef<HTMLButtonElement>(null);
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
    const sidebar = sidebarRef.current;
    if (!mobileOpen || !sidebar) return;

    // Keep this breakpoint aligned with the mobile drawer in globals.css.
    const mobileViewport = window.matchMedia("(max-width: 860px)");
    if (!mobileViewport.matches) {
      setMobileOpen(false);
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    mobileCloseRef.current?.focus();

    const handleKeyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileOpen(false);
        return;
      }
      if (event.key !== "Tab") return;

      const controls = Array.from(
        sidebar.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) =>
        element.getClientRects().length > 0 &&
        window.getComputedStyle(element).visibility !== "hidden",
      );
      const first = controls[0];
      const last = controls[controls.length - 1];
      const active = document.activeElement;

      if (!first || !last) {
        event.preventDefault();
        sidebar.focus();
      } else if (event.shiftKey && (active === first || !sidebar.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !sidebar.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };
    const closeOnDesktop = () => {
      if (!mobileViewport.matches) setMobileOpen(false);
    };

    document.addEventListener("keydown", handleKeyboard);
    mobileViewport.addEventListener("change", closeOnDesktop);
    return () => {
      document.removeEventListener("keydown", handleKeyboard);
      mobileViewport.removeEventListener("change", closeOnDesktop);
      document.body.style.overflow = previousOverflow;

      const trigger = mobileTriggerRef.current;
      if (trigger && trigger.getClientRects().length > 0) trigger.focus();
    };
  }, [mobileOpen]);

  return (
    <div
      className={`private-shell${collapsed ? " is-collapsed" : ""}${
        mobileOpen ? " is-mobile-open" : ""
      }`}
    >
      <aside
        ref={sidebarRef}
        id="private-navigation"
        className="private-sidebar"
        role={mobileOpen ? "dialog" : undefined}
        aria-modal={mobileOpen ? true : undefined}
        aria-label="Навігація кабінету"
        tabIndex={mobileOpen ? -1 : undefined}
      >
        <div className="private-brand-row">
          <Brand compact={collapsed} />
          <button
            className="icon-control desktop-collapse"
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? "Розгорнути меню" : "Згорнути меню ліворуч"}
            aria-expanded={!collapsed}
            aria-controls="private-navigation"
          >
            {collapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
          </button>
          <button
            ref={mobileCloseRef}
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
        tabIndex={-1}
      />

      <div className="private-workspace" inert={mobileOpen ? true : undefined}>
        <header className="private-topbar">
          <button
            ref={mobileTriggerRef}
            className="icon-control mobile-menu-button"
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Відкрити меню"
            aria-expanded={mobileOpen}
            aria-controls="private-navigation"
          >
            <Menu size={21} />
          </button>
          <div className="topbar-title">
            <span>{user.roleLabel}</span>
            <strong>{activeItem?.label ?? "Кабінет"}</strong>
          </div>
          <div className="topbar-actions">
            <span className={`role-badge role-${user.role}`}>{user.roleLabel}</span>
            <form action={signOutAction}>
              <button className="icon-control" type="submit" aria-label="Вийти">
                <LogOut size={19} />
              </button>
            </form>
          </div>
        </header>
        <main className="private-content">{children}</main>
      </div>
    </div>
  );
}
