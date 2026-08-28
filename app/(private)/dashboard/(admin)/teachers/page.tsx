import { Check, Clock3, UsersRound } from "lucide-react";

import { PageIntro } from "@/components/page-intro";
import { EmptyState } from "@/components/private/empty-state";
import { ManagementTable } from "@/components/private/management-table";
import { ManagementSubmit } from "@/components/private/management-submit";
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
    <section className="management-page">
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
        <ManagementTable caption="Облікові записи викладачів" columns={["ПІБ", "Електронна пошта", "Роль", "Доступ", "Дії"]} minWidth={980}>
          <tbody>
          {teachers.map((teacher) => (
            <tr key={teacher.id}>
              <th scope="row">{teacher.fullName}</th>
              <td>{teacher.email}</td>
              <td>{teacher.role === "administrator" ? "Адміністратор + викладач" : "Викладач"}</td>
              <td><span className={`approval-badge is-${teacher.approval}`}>
                {teacher.approval === "approved" ? (
                  <>
                    <Check size={14} /> Схвалено
                  </>
                ) : (
                  <>
                    <Clock3 size={14} /> Очікує
                  </>
                )}
              </span></td>
              <td className="management-actions-cell">
              {teacher.approval === "pending" ? (
                <form action={approveTeacher}>
                  <input type="hidden" name="userId" value={teacher.id} />
                  <ManagementSubmit className="button button-primary" aria-label={`Схвалити доступ: ${teacher.fullName}`}>
                    Схвалити доступ
                  </ManagementSubmit>
                </form>
              ) : teacher.isBootstrapAdministrator ? (
                <span className="teacher-approved-note">Захищений адміністратор — пониження недоступне</span>
              ) : <AccountRoleForm key={teacher.role} userId={teacher.id} role={teacher.role} />}
              </td>
            </tr>
          ))}
          </tbody>
        </ManagementTable>
      )}
    </section>
  );
}
