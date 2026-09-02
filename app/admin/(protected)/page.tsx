import Link from "next/link";

import { PageIntro } from "@/components/page-intro";

const sections = [
  ["Розклад", "/admin/schedule", "Створення, редагування та контроль актуального розкладу."],
  ["Імпорт JSON", "/admin/import", "Попередній аналіз і безпечний повторний імпорт файлу."],
  ["Переноси та винятки", "/admin/exceptions", "Разові зміни без переписування базового розкладу."],
  ["Навчальні тижні", "/admin/week-settings", "Базова дата й межі семестру."],
] as const;

export default function AdminHomePage() {
  return <section className="management-page">
    <PageIntro eyebrow="АДМІНІСТРУВАННЯ" title="Керування розкладом"
      description="Єдиний робочий простір для довідників, імпорту, базового розкладу та разових винятків." />
    <div className="dashboard-grid">
      {sections.map(([title, href, description]) => <Link className="dashboard-card" href={href} key={href}>
        <span className="eyebrow">РОЗДІЛ</span><h2>{title}</h2><p>{description}</p>
      </Link>)}
    </div>
  </section>;
}
