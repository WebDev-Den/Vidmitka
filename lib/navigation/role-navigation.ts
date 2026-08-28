import type { AppRole } from "@/lib/auth/roles";

export type NavigationIcon =
  | "overview"
  | "schedule"
  | "lessons"
  | "import"
  | "create"
  | "teachers"
  | "subjects"
  | "rooms"
  | "periods"
  | "students"
  | "profile"
  | "settings";

export type NavigationItem = Readonly<{
  id: string;
  label: string;
  href: string;
  icon: NavigationIcon;
}>;

const teacherNavigation: readonly NavigationItem[] = [
  { id: "journal", label: "Журнал занять", href: "/dashboard/journal", icon: "lessons" },
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
    id: "import-schedule",
    label: "Імпорт розкладу",
    href: "/dashboard/import-schedule",
    icon: "import",
  },
  {
    id: "students",
    label: "Мої студенти",
    href: "/dashboard/students",
    icon: "students",
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
  ...teacherNavigation,
  {
    id: "teachers",
    label: "Користувачі",
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
  { id: "lesson-types", label: "Типи занять", href: "/dashboard/lesson-types", icon: "subjects" },
  {
    id: "periods",
    label: "Пари та час",
    href: "/dashboard/periods",
    icon: "periods",
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
