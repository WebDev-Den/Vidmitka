import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { PageIntro } from "@/components/page-intro";

const mainSections = [
  ["Розклад", "/admin/schedule", "Заняття та їхній стан"],
  ["Переноси", "/admin/exceptions", "Разові зміни й скасування"],
  ["Імпорт JSON", "/admin/import", "Перевірка та імпорт файлу"],
  ["Push cron", "/admin/cron", "Статус і запуск QStash"],
  ["Навчальні тижні", "/admin/week-settings", "Семестр і чергування тижнів"],
] as const;

const directorySections = [
  ["Групи", "/admin/groups", "Навчальні групи"],
  ["Викладачі", "/admin/teachers", "Перелік викладачів"],
  ["Дисципліни", "/admin/disciplines", "Назви дисциплін"],
  ["Аудиторії", "/admin/rooms", "Навчальні приміщення"],
  ["Типи занять", "/admin/lesson-types", "Лекції, практичні та інші типи"],
  ["Пари та час", "/admin/periods", "Номери й часові межі"],
] as const;

export default function AdminHomePage() {
  return <section className="management-page">
    <PageIntro eyebrow="АДМІНІСТРУВАННЯ" title="Керування розкладом"
      description="Виберіть розділ для роботи." />
    <nav className="admin-index" aria-label="Розділи адміністрування">
      <AdminIndexGroup id="admin-main" title="Основне" items={mainSections} />
      <AdminIndexGroup id="admin-directories" title="Довідники" items={directorySections} />
    </nav>
  </section>;
}

function AdminIndexGroup({
  id,
  title,
  items,
}: {
  id: string;
  title: string;
  items: readonly (readonly [string, string, string])[];
}) {
  return <section className="admin-index-group" aria-labelledby={id}>
    <h2 id={id}>{title}</h2>
    <div className="admin-index-list">
      {items.map(([label, href, description]) => <Link className="admin-index-link" href={href} key={href}>
        <span><strong>{label}</strong><small>{description}</small></span>
        <ChevronRight size={17} aria-hidden="true" />
      </Link>)}
    </div>
  </section>;
}
