import { Check, Clock3, UsersRound } from "lucide-react";

import { PageIntro } from "@/components/page-intro";
import { EmptyState } from "@/components/private/empty-state";
import { listStaffAccounts } from "@/lib/auth/repository";
import { requireAdministrator } from "@/lib/auth/session";

import { approveTeacher } from "./actions";
import { AccountRoleForm } from "./role-form";

export default async function TeachersPage() {
  await requireAdministrator();
  const teachers = await listStaffAccounts();

  const pendingCount = teachers.filter(
    (teacher) => teacher.approval === "pending",
  ).length;

  return (
    <section>
      <PageIntro
        eyebrow="АДМІНІСТРУВАННЯ"
        title="Викладачі та адміністратори"
        description="Схвалюйте доступ і керуйте ролями. Адміністратор також має всі викладацькі можливості."
        actions={
          <span className="pending-summary">
            <Clock3 size={16} /> Очікують: {pendingCount}
          </span>
        }
      />

      {teachers.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title="Заявок викладачів ще немає"
          description="Новий обліковий запис з’явиться тут одразу після завершення реєстрації."
        />
      ) : (
        <div className="teacher-list" aria-label="Облікові записи викладачів">
          {teachers.map((teacher) => (
            <article className="teacher-row" key={teacher.id} aria-label={teacher.fullName}>
              <span className="teacher-avatar" aria-hidden="true">
                {teacher.fullName.slice(0, 2).toUpperCase()}
              </span>
              <span className="teacher-identity">
                <strong>{teacher.fullName}</strong>
                <small>{teacher.email}</small>
                <small>{teacher.role === "administrator" ? "Адміністратор + викладач" : "Викладач"}</small>
              </span>
              <span className={`approval-badge is-${teacher.approval}`}>
                {teacher.approval === "approved" ? (
                  <>
                    <Check size={14} /> Схвалено
                  </>
                ) : (
                  <>
                    <Clock3 size={14} /> Очікує
                  </>
                )}
              </span>
              {teacher.approval === "pending" ? (
                <form action={approveTeacher}>
                  <input type="hidden" name="userId" value={teacher.id} />
                  <button className="button button-primary" type="submit">
                    Схвалити доступ
                  </button>
                </form>
              ) : teacher.isBootstrapAdministrator ? (
                <span className="teacher-approved-note">Захищений адміністратор — пониження недоступне</span>
              ) : <AccountRoleForm key={teacher.role} userId={teacher.id} role={teacher.role} />}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
