import type { AppRole } from "@/lib/auth/roles";

export type NavigationIcon =
  | "overview"
  | "schedule"
  | "lessons"
  | "create"
  | "teachers"
  | "subjects"
  | "rooms"
  | "profile"
  | "settings";

export type NavigationItem = Readonly<{
  id: string;
  label: string;
  href: string;
  icon: NavigationIcon;
}>;

const teacherNavigation: readonly NavigationItem[] = [
  { id: "overview", label: "Огляд", href: "/dashboard", icon: "overview" },
  {
    id: "my-lessons",
    label: "Мої заняття",
    href: "/dashboard/my-lessons",
    icon: "lessons",
  },
  {
    id: "schedule",
    label: "Загальний розклад",
    href: "/dashboard/schedule",
    icon: "schedule",
  },
  {
    id: "create-lesson",
    label: "Створити заняття",
    href: "/dashboard/lessons/new",
    icon: "create",
  },
  {
    id: "profile",
    label: "Профіль",
    href: "/dashboard/profile",
    icon: "profile",
  },
];

const administratorNavigation: readonly NavigationItem[] = [
  { id: "overview", label: "Огляд", href: "/dashboard", icon: "overview" },
  {
    id: "schedule",
    label: "Увесь розклад",
    href: "/dashboard/schedule",
    icon: "schedule",
  },
  {
    id: "create-lesson",
    label: "Створити заняття",
    href: "/dashboard/lessons/new",
    icon: "create",
  },
  {
    id: "teachers",
    label: "Викладачі",
    href: "/dashboard/teachers",
    icon: "teachers",
  },
  {
    id: "subjects",
    label: "Предмети",
    href: "/dashboard/subjects",
    icon: "subjects",
  },
  {
    id: "rooms",
    label: "Аудиторії",
    href: "/dashboard/rooms",
    icon: "rooms",
  },
  {
    id: "settings",
    label: "Налаштування",
    href: "/dashboard/settings",
    icon: "settings",
  },
];

export function getRoleNavigation(
  role: AppRole,
): readonly NavigationItem[] {
  return role === "administrator"
    ? administratorNavigation
    : teacherNavigation;
}
