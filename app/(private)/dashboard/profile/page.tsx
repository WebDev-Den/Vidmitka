import { CircleUserRound } from "lucide-react";

import { PageIntro } from "@/components/page-intro";
import { requireAppUser } from "@/lib/auth/session";

export default async function ProfilePage() {
  const user = await requireAppUser();

  return (
    <section>
      <PageIntro
        eyebrow="ОБЛІКОВИЙ ЗАПИС"
        title="Профіль"
        description="Дані вашого захищеного облікового запису в системі."
      />
      <div className="profile-summary">
        <span className="profile-avatar"><CircleUserRound size={28} /></span>
        <div><span>Ім’я</span><strong>{user.name}</strong></div>
        <div><span>Email</span><strong>{user.email}</strong></div>
        <div><span>Роль у системі</span><strong>{user.roleLabel}</strong></div>
      </div>
    </section>
  );
}
