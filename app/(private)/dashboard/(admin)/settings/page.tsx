import { ShieldCheck } from "lucide-react";

import { PageIntro } from "@/components/page-intro";
import { getScheduleWeekSettings } from "@/lib/schedule-week/repository";

import { SemesterEndForm } from "./semester-end-form";
import { WeekSettingsForm } from "./week-settings-form";

export default async function SettingsPage() {
  const weekSettings = await getScheduleWeekSettings();

  return (
    <section>
      <PageIntro
        eyebrow="АДМІНІСТРУВАННЯ"
        title="Налаштування системи"
        description="Налаштуйте календарне чергування навчальних тижнів і перевірте правила адміністративного доступу."
      />
      <WeekSettingsForm settings={weekSettings} />
      <SemesterEndForm />
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
