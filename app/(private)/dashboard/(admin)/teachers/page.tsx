import { clerkClient } from "@clerk/nextjs/server";
import { Check, Clock3, UsersRound } from "lucide-react";

import { PageIntro } from "@/components/page-intro";
import { EmptyState } from "@/components/private/empty-state";
import { resolveAccountAccess } from "@/lib/auth/roles";
import { requireAdministrator } from "@/lib/auth/session";

import { approveTeacher } from "./actions";

function getPrimaryEmail(user: {
  primaryEmailAddressId: string | null;
  emailAddresses: Array<{ id: string; emailAddress: string }>;
}): string | null {
  return (
    user.emailAddresses.find(
      (email) => email.id === user.primaryEmailAddressId,
    )?.emailAddress ?? null
  );
}

export default async function TeachersPage() {
  await requireAdministrator();

  const client = await clerkClient();
  const { data: users } = await client.users.getUserList({
    limit: 100,
    orderBy: "-created_at",
  });

  const teachers = users.flatMap((user) => {
    const email = getPrimaryEmail(user);
    const access = resolveAccountAccess(
      email,
      user.privateMetadata.approved,
    );

    if (!email || access.role !== "teacher") return [];

    return [
      {
        id: user.id,
        email,
        name:
          [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
          email.split("@")[0],
        approval: access.approval,
      },
    ];
  });

  const pendingCount = teachers.filter(
    (teacher) => teacher.approval === "pending",
  ).length;

  return (
    <section>
      <PageIntro
        eyebrow="АДМІНІСТРУВАННЯ"
        title="Викладачі"
        description="Схвалюйте нові облікові записи перед наданням доступу до приватного кабінету."
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
            <article className="teacher-row" key={teacher.id}>
              <span className="teacher-avatar" aria-hidden="true">
                {teacher.name.slice(0, 2).toUpperCase()}
              </span>
              <span className="teacher-identity">
                <strong>{teacher.name}</strong>
                <small>{teacher.email}</small>
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
              ) : (
                <span className="teacher-approved-note">Доступ активний</span>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
