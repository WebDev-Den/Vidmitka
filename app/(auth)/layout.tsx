import { Brand } from "@/components/brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth-shell">
      <section className="auth-story">
        <Brand />
        <div>
          <span className="hero-kicker">ЗАХИЩЕНИЙ ДОСТУП</span>
          <h1>Ваш робочий простір починається тут.</h1>
          <p>
            Після входу система перевірить права вашого облікового запису.
            Адміністратор має викладацькі можливості та додаткові інструменти керування.
          </p>
        </div>
        <span className="auth-note">Захищена сесія · контроль доступу</span>
      </section>
      <section className="auth-form-area">{children}</section>
    </main>
  );
}
