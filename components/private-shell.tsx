"use client";

import {
  BookOpen,
  BellRing,
  Building2,
  CalendarDays,
  ChevronDown,
  Clock3,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
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
import { NavigationLinkContent } from "@/components/private/navigation-link-content";
import { adminSignOutAction } from "@/app/admin/actions";
import type { AppUser } from "@/lib/auth/session";
import {
  getRoleNavigation,
  type NavigationIcon,
} from "@/lib/navigation/role-navigation";

const iconByName: Record<NavigationIcon, LucideIcon> = {
  overview: LayoutDashboard,
  schedule: CalendarDays,
  import: Upload,
  teachers: UsersRound,
  subjects: BookOpen,
  rooms: Building2,
  periods: Clock3,
  groups: GraduationCap,
  settings: Settings2,
  push: BellRing,
};

const directoryNavigationIds = new Set([
  "groups",
  "teachers",
  "subjects",
  "rooms",
  "lesson-types",
  "periods",
]);

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
  const primaryNavigation = navigation.filter(
    (item) => !directoryNavigationIds.has(item.id),
  );
  const directoryNavigation = navigation.filter((item) =>
    directoryNavigationIds.has(item.id),
  );
  const directoryActive = directoryNavigation.some(
    (item) =>
      pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const directoryExpanded = !collapsed && (directoryOpen || directoryActive);
  const activeItem =
    navigation.find(
      (item) =>
        pathname === item.href ||
        (item.href !== "/admin" && pathname.startsWith(`${item.href}/`)),
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
          <Brand />
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

        <nav className="role-navigation" aria-label={`Меню ролі ${user.roleLabel}`}>
          {primaryNavigation.map((item) => {
            const Icon = iconByName[item.icon];
            const active =
              pathname === item.href ||
              (item.href !== "/admin" && pathname.startsWith(`${item.href}/`));

            return (
              <Link
                key={item.id}
                className={active ? "role-link is-active" : "role-link"}
                href={item.href}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                title={collapsed ? item.label : undefined}
              >
                <NavigationLinkContent icon={Icon} label={item.label} active={active} />
              </Link>
            );
          })}

          {directoryNavigation.length ? (
            <div className="navigation-group">
              <button
                className={`role-link navigation-group-toggle${
                  directoryActive ? " is-active" : ""
                }`}
                type="button"
                onClick={() => {
                  if (collapsed) {
                    setCollapsed(false);
                    setDirectoryOpen(true);
                    return;
                  }
                  setDirectoryOpen((value) => !value);
                }}
                aria-expanded={directoryExpanded}
                aria-controls="admin-directory-navigation"
                title={collapsed ? "Довідники" : undefined}
              >
                <span className="role-link-icon" aria-hidden="true">
                  <BookOpen size={19} />
                </span>
                <span className="role-link-label">Довідники</span>
                <ChevronDown
                  className="role-link-chevron navigation-group-chevron"
                  size={16}
                  aria-hidden="true"
                />
              </button>
              <div
                id="admin-directory-navigation"
                className="navigation-submenu"
                hidden={!directoryExpanded}
              >
                {directoryNavigation.map((item) => {
                  const Icon = iconByName[item.icon];
                  const active =
                    pathname === item.href || pathname.startsWith(`${item.href}/`);

                  return (
                    <Link
                      key={item.id}
                      className={active ? "role-link is-active" : "role-link"}
                      href={item.href}
                      aria-label={item.label}
                      aria-current={active ? "page" : undefined}
                    >
                      <NavigationLinkContent icon={Icon} label={item.label} active={active} />
                    </Link>
                  );
                })}
              </div>
            </div>
          ) : null}
        </nav>

        <div className="sidebar-user">
          <span className="user-initials">{user.initials}</span>
          <span className="sidebar-user-copy">
            <strong>{user.name}</strong>
            <small>{user.email}</small>
          </span>
          <form action={adminSignOutAction}>
            <button className="icon-control" type="submit" aria-label="Вийти">
              <LogOut size={18} />
            </button>
          </form>
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
            <strong>{activeItem?.label ?? "Кабінет"}</strong>
          </div>
        </header>
        <main className="private-content">{children}</main>
      </div>
    </div>
  );
}
