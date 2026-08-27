import { ShieldCheck } from "lucide-react";

import { PageIntro } from "@/components/page-intro";
import { requireAdministrator } from "@/lib/auth/session";
import { getScheduleWeekSettings } from "@/lib/schedule-week/repository";
import { getDateKeyInTimeZone } from "@/lib/schedule-week/rules";

import { SemesterEndForm } from "./semester-end-form";
import { WeekSettingsForm } from "./week-settings-form";

export default async function SettingsPage() {
  await requireAdministrator();
  const weekSettings = await getScheduleWeekSettings();

  return (
    <section>
      <PageIntro
        eyebrow="АДМІНІСТРУВАННЯ"
        title="Налаштування системи"
        description="Налаштуйте календарне чергування навчальних тижнів і перевірте правила адміністративного доступу."
      />
      <WeekSettingsForm settings={weekSettings} today={getDateKeyInTimeZone(new Date())} />
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
