import type { AppRole } from "@/lib/auth/roles";

export type NavigationIcon =
  | "overview"
  | "schedule"
  | "import"
  | "teachers"
  | "subjects"
  | "rooms"
  | "periods"
  | "groups"
  | "settings"
  | "cron";

export type NavigationItem = Readonly<{
  id: string;
  label: string;
  href: string;
  icon: NavigationIcon;
}>;

const administratorNavigation: readonly NavigationItem[] = [
  { id: "overview", label: "Огляд", href: "/admin", icon: "overview" },
  { id: "schedule", label: "Розклад", href: "/admin/schedule", icon: "schedule" },
  { id: "groups", label: "Групи", href: "/admin/groups", icon: "groups" },
  {
    id: "teachers",
    label: "Викладачі",
    href: "/admin/teachers",
    icon: "teachers",
  },
  {
    id: "subjects",
    label: "Дисципліни",
    href: "/admin/disciplines",
    icon: "subjects",
  },
  {
    id: "rooms",
    label: "Аудиторії",
    href: "/admin/rooms",
    icon: "rooms",
  },
  { id: "lesson-types", label: "Типи занять", href: "/admin/lesson-types", icon: "subjects" },
  {
    id: "periods",
    label: "Пари та час",
    href: "/admin/periods",
    icon: "periods",
  },
  { id: "exceptions", label: "Переноси та винятки", href: "/admin/exceptions", icon: "schedule" },
  { id: "import", label: "Імпорт JSON", href: "/admin/import", icon: "import" },
  { id: "cron", label: "Push cron", href: "/admin/cron", icon: "cron" },
  { id: "settings", label: "Навчальні тижні", href: "/admin/week-settings", icon: "settings" },
];

export function getRoleNavigation(
  role: AppRole,
): readonly NavigationItem[] {
  return role === "administrator" ? administratorNavigation : [];
}
