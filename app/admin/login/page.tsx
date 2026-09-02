import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Brand } from "@/components/brand";
import { getOptionalAppUser } from "@/lib/auth/session";
import { isApprovedAdministrator } from "@/lib/auth/authorization";

import { AdminLoginForm } from "./admin-login-form";

export const metadata: Metadata = { title: "Вхід адміністратора" };

export default async function AdminLoginPage() {
  const user = await getOptionalAppUser();
  if (isApprovedAdministrator(user)) redirect("/admin");

  return <main className="auth-shell">
    <section className="auth-story">
      <Brand />
      <div>
        <span className="hero-kicker">ЗАХИЩЕНИЙ ДОСТУП</span>
        <h1>Керування навчальним розкладом.</h1>
        <p>Адміністративна частина не відображається в публічній навігації та перевіряє сесію на сервері.</p>
      </div>
      <span className="auth-note">Захищена сесія · єдиний адміністратор</span>
    </section>
    <section className="auth-form-area"><AdminLoginForm /></section>
  </main>;
}
