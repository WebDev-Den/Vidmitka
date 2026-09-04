import type { Metadata } from "next";

import { PageIntro } from "@/components/page-intro";

import { AdminScheduleImportForm } from "./import-form";
import styles from "./transfer.module.css";

export const metadata: Metadata = { title: "Імпорт та експорт" };

export default function AdminImportPage() {
  return <section className={`management-page ${styles.page}`}>
    <PageIntro eyebrow="АДМІНІСТРУВАННЯ" title="Імпорт та експорт розкладу"
      description="Завантажте поточний розклад або перевірте файл перед внесенням змін." />
    <AdminScheduleImportForm />
  </section>;
}
