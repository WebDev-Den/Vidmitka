import type { Metadata } from "next";
import { Suspense } from "react";

import { PageIntro } from "@/components/page-intro";
import { PublicHeader } from "@/components/public-header";
import { TransfersTable } from "./transfers-table";

export const metadata: Metadata = { title: "Перенесення пар" };

const intro = {
  eyebrow: "ПУБЛІЧНИЙ ДОСТУП",
  title: "Перенесення пар",
  description: "Дати, у які заняття проводяться за розкладом іншого дня, а також окремі заміни й скасування.",
};

export default function PublicTransfersPage() {
  return <>
    <div className="public-header-surface"><PublicHeader /></div>
    <main className="public-content management-page">
      <PageIntro {...intro} />
      <Suspense fallback={<p className="route-loading" role="status">
        <span className="navigation-spinner" aria-hidden="true" /> Завантаження перенесень пар…
      </p>}>
        <TransfersTable />
      </Suspense>
    </main>
  </>;
}
