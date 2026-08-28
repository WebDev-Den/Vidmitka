import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PageIntro } from "@/components/page-intro";
import { PublicHeader } from "@/components/public-header";
import { getOptionalAppUser } from "@/lib/auth/session";
import { TransfersTable } from "./transfers-table";

export const metadata: Metadata = { title: "Перенесення пар" };

async function TransfersIntro() {
  const user = await getOptionalAppUser();
  const canManage = user?.role === "administrator" && user.approval === "approved";
  return <PageIntro {...intro} actions={canManage ? (
    <Link className="button button-light" href="/dashboard/settings#makeup-days-heading">
      Керувати перенесеннями
    </Link>
  ) : undefined} />;
}

const intro = {
  eyebrow: "ПУБЛІЧНИЙ ДОСТУП",
  title: "Перенесення пар",
  description: "У зазначені дати заняття проходять за розкладом указаного дня та типу тижня.",
};

export default function PublicTransfersPage() {
  return <>
    <div className="public-header-surface"><PublicHeader /></div>
    <main className="public-content management-page">
      <Suspense fallback={<PageIntro {...intro} />}><TransfersIntro /></Suspense>
      <Suspense fallback={<p className="route-loading" role="status">
        <span className="navigation-spinner" aria-hidden="true" /> Завантаження перенесень пар…
      </p>}>
        <TransfersTable />
      </Suspense>
    </main>
  </>;
}
