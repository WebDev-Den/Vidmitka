import { Clock3, ExternalLink, LogOut } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Brand } from "@/components/brand";
import { signOutAction } from "@/app/(auth)/actions";
import { getAuthenticatedAppUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Очікування підтвердження" };

export default async function ApprovalPendingPage() {
  const user = await getAuthenticatedAppUser();

  if (user.approval === "approved") redirect("/dashboard");

  return (
    <main className="approval-shell">
      <header className="approval-header">
        <Brand />
        <form action={signOutAction}>
          <button className="button button-light" type="submit">
            <LogOut size={16} /> Вийти
          </button>
        </form>
      </header>

      <section className="approval-card">
        <span className="approval-icon" aria-hidden="true">
          <Clock3 size={28} />
        </span>
        <span className="eyebrow">РЕЄСТРАЦІЮ ЗАВЕРШЕНО</span>
        <h1>Акаунт очікує підтвердження</h1>
        <p>
          Адміністратор має схвалити доступ для <strong>{user.email}</strong>.
          Після схвалення поверніться сюди й перевірте статус.
        </p>
        <div className="approval-actions">
          <Link className="button button-primary" href="/dashboard">
            Перевірити статус
          </Link>
          <Link className="button approval-secondary" href="/schedule">
            Переглянути розклад <ExternalLink size={16} />
          </Link>
        </div>
      </section>
    </main>
  );
}
