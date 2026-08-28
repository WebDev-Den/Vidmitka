import {
  ArrowRight,
  CalendarRange,
  CheckCircle2,
  GraduationCap,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { PublicHeader } from "@/components/public-header";
import { UpcomingLessonsCard } from "@/components/upcoming-lessons-card";

export default function PublicHomePage() {
  return (
    <>
      <div className="public-hero">
        <PublicHeader />
        <div className="hero-grid" aria-hidden="true" />
        <div className="hero-content">
          <div className="hero-copy">
            <span className="hero-kicker">ЄДИНИЙ НАВЧАЛЬНИЙ ПРОСТІР</span>
            <h1>Розклад, у якому немає місця конфліктам.</h1>
            <p>
              Викладачі створюють заняття, адміністратори контролюють систему,
              а актуальний розклад залишається доступним для всіх.
            </p>
            <div className="hero-actions">
              <Link className="button button-accent" href="/schedule">
                Переглянути розклад <ArrowRight size={18} />
              </Link>
              <Link className="button button-ghost-light" href="/sign-in">
                Увійти до кабінету
              </Link>
            </div>
          </div>

          <Suspense fallback={<section className="schedule-preview" aria-label="Найближчі заняття" aria-busy="true"><p role="status">Завантаження найближчих занять…</p></section>}>
            <UpcomingLessonsCard />
          </Suspense>
        </div>
      </div>

      <main className="public-main">
        <section className="public-intro" id="roles">
          <span className="section-index">01</span>
          <div>
            <span className="eyebrow">РОЛІ ТА ДОСТУП</span>
            <h2>Одна система. Різна відповідальність.</h2>
          </div>
          <p>
            Публічна частина показує опублікований розклад. Приватний кабінет
            відкриває лише ті інструменти, які відповідають ролі користувача.
          </p>
        </section>

        <section className="role-columns">
          <article>
            <span className="role-icon"><GraduationCap size={24} /></span>
            <span className="eyebrow">ВИКЛАДАЧ</span>
            <h3>Власні заняття під контролем</h3>
            <ul>
              <li><CheckCircle2 size={17} /> Створення і редагування власних занять</li>
              <li><CheckCircle2 size={17} /> Перегляд загального розкладу</li>
              <li><CheckCircle2 size={17} /> Попередження про часові конфлікти</li>
            </ul>
          </article>
          <article>
            <span className="role-icon"><ShieldCheck size={24} /></span>
            <span className="eyebrow">АДМІНІСТРАТОР</span>
            <h3>Цілісність усього розкладу</h3>
            <ul>
              <li><CheckCircle2 size={17} /> Керування всіма заняттями</li>
              <li><CheckCircle2 size={17} /> Викладачі, предмети й аудиторії</li>
              <li><CheckCircle2 size={17} /> Контроль актуальності даних</li>
            </ul>
          </article>
        </section>

        <section className="public-cta">
          <CalendarRange size={32} />
          <div>
            <span className="eyebrow">АКТУАЛЬНИЙ СТАН</span>
            <h2>Потрібен розклад без входу?</h2>
          </div>
          <Link className="button button-dark" href="/schedule">
            Відкрити публічний розклад <ArrowRight size={18} />
          </Link>
        </section>
      </main>

      <footer className="public-footer">
        <strong>Відмітка</strong>
        <span>Система керування навчальним розкладом</span>
      </footer>
    </>
  );
}
