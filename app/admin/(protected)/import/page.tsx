import type { Metadata } from "next";

import { PageIntro } from "@/components/page-intro";

import { AdminScheduleImportForm } from "./import-form";

export const metadata: Metadata = { title: "Імпорт JSON" };

export default function AdminImportPage() {
  return <section className="management-page">
    <PageIntro eyebrow="АДМІНІСТРУВАННЯ" title="Імпорт розкладу з JSON"
      description="Система перевіряє фактичну структуру, створює відсутні довідники й повторно використовує вже імпортовані записи." />
    <AdminScheduleImportForm />
  </section>;
}
