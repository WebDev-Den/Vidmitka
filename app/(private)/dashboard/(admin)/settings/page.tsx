import { ShieldCheck } from "lucide-react";

import { PageIntro } from "@/components/page-intro";
import { requireAdministrator } from "@/lib/auth/session";
import { getScheduleWeekSettings } from "@/lib/schedule-week/repository";
import { getDateKeyInTimeZone } from "@/lib/schedule-week/rules";
import { listMakeupDays } from "@/lib/schedule-calendar/repository";

import { SemesterEndForm } from "./semester-end-form";
import { WeekSettingsForm } from "./week-settings-form";
import { MakeupDaysManager } from "./makeup-days-manager";
import styles from "./settings.module.css";

export default async function SettingsPage() {
  await requireAdministrator();
  const [weekSettings, makeupDays] = await Promise.all([getScheduleWeekSettings(), listMakeupDays()]);

  return (
    <section className={styles.page}>
      <PageIntro
        eyebrow="АДМІНІСТРУВАННЯ"
        title="Налаштування системи"
        description="Налаштуйте календарне чергування навчальних тижнів і перевірте правила адміністративного доступу."
      />
      <WeekSettingsForm settings={weekSettings} today={getDateKeyInTimeZone(new Date())} />
      <MakeupDaysManager days={makeupDays} />
      <SemesterEndForm />
      <div className="settings-explanation">
        <ShieldCheck size={26} />
        <div>
          <h2>Адміністративний доступ захищено</h2>
          <p>
            Право керувати календарем перевіряється на сервері за поточним
            схваленим обліковим записом адміністратора.
          </p>
        </div>
      </div>
    </section>
  );
}
