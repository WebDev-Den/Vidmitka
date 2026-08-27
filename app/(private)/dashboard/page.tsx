import {
  ArrowRight,
  BookOpen,
  Building2,
  CalendarPlus,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { PageIntro } from "@/components/page-intro";
import { EmptyState } from "@/components/private/empty-state";
import { requireAppUser } from "@/lib/auth/session";

export default async function DashboardPage() {
  const user = await requireAppUser();
  if (user.role === "teacher") redirect("/dashboard/journal");
  const isAdministrator = user.role === "administrator";

  return (
    <section>
      <PageIntro
        eyebrow={isAdministrator ? "АДМІНІСТРУВАННЯ" : "КАБІНЕТ ВИКЛАДАЧА"}
        title={`Вітаємо, ${user.name.split(" ")[0]}`}
        description={
          isAdministrator
            ? "Контролюйте довідники, користувачів і цілісність навчального розкладу."
            : "Плануйте власні заняття та стежте за актуальним розкладом."
        }
        actions={
          <Link
            className="button button-primary"
            href={
              isAdministrator ? "/dashboard/teachers" : "/dashboard/lessons/new"
            }
          >
            {isAdministrator ? "Керувати викладачами" : "Створити заняття"}
            <ArrowRight size={17} />
          </Link>
        }
      />

      <div className="metric-strip" aria-label="Стан системи">
        {isAdministrator ? (
          <>
            <div><UsersRound size={19} /><span><strong>0</strong><small>викладачів</small></span></div>
            <div><BookOpen size={19} /><span><strong>0</strong><small>предметів</small></span></div>
            <div><Building2 size={19} /><span><strong>0</strong><small>аудиторій</small></span></div>
            <div><CalendarPlus size={19} /><span><strong>0</strong><small>занять</small></span></div>
          </>
        ) : (
          <>
            <div><CalendarPlus size={19} /><span><strong>0</strong><small>моїх занять</small></span></div>
            <div><BookOpen size={19} /><span><strong>0</strong><small>предметів</small></span></div>
            <div><Building2 size={19} /><span><strong>0</strong><small>аудиторій сьогодні</small></span></div>
          </>
        )}
      </div>

      <div className="dashboard-section-heading">
        <div>
          <span className="eyebrow">НАЙБЛИЖЧІ ДІЇ</span>
          <h2>{isAdministrator ? "Стан наповнення системи" : "Найближчі заняття"}</h2>
        </div>
        <Link href="/dashboard/schedule">Переглянути розклад <ArrowRight size={16} /></Link>
      </div>

      <EmptyState
        icon={isAdministrator ? UsersRound : CalendarPlus}
        title={
          isAdministrator
            ? "Почніть із додавання викладачів"
            : "У вас ще немає створених занять"
        }
        description={
          isAdministrator
            ? "Після цього додайте предмети й аудиторії, щоб сформувати перше заняття."
            : "Створіть заняття після того, як адміністратор заповнить довідники."
        }
      />
    </section>
  );
}
