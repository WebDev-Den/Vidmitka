import { Suspense } from "react";

import { HomeScheduleBoard } from "@/components/home-schedule-board";
import { PublicHeader } from "@/components/public-header";

export default async function PublicHomePage({ searchParams }: {
  searchParams: Promise<{ date?: string | string[] }>;
}) {
  const { date } = await searchParams;
  return (
    <>
      <PublicHeader />
      <main>
        <Suspense fallback={<section className="home-schedule-loading" aria-busy="true">
          <p role="status">Завантаження розкладу…</p>
        </section>}>
          <HomeScheduleBoard selectedDate={date} />
        </Suspense>
      </main>

      <footer className="public-footer">
        <strong>Відмітка</strong>
        <span>Система керування навчальним розкладом</span>
      </footer>
    </>
  );
}
