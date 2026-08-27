import { ShieldCheck } from "lucide-react";

import { PageIntro } from "@/components/page-intro";

export default function SettingsPage() {
  return (
    <section>
      <PageIntro
        eyebrow="АДМІНІСТРУВАННЯ"
        title="Налаштування доступу"
        description="Роль адміністратора визначається серверною змінною ADMIN_EMAILS."
      />
      <div className="settings-explanation">
        <ShieldCheck size={26} />
        <div>
          <h2>Адміністративний доступ захищено</h2>
          <p>
            Email поточного користувача порівнюється з нормалізованим списком у
            серверному середовищі. Значення не передається у браузер.
          </p>
        </div>
      </div>
    </section>
  );
}
