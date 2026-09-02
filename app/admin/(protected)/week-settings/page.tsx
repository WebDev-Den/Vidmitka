import { PageIntro } from "@/components/page-intro";
import { getScheduleWeekConfiguration } from "@/lib/schedule-week/repository";

import { WeekSettingsForm } from "./week-settings-form";

export default async function WeekSettingsPage() {
  return <section className="management-page"><PageIntro eyebrow="КАЛЕНДАР" title="Навчальні тижні"
    description="Єдине глобальне налаштування для чергування чисельника й знаменника." />
    <WeekSettingsForm settings={await getScheduleWeekConfiguration()} /></section>;
}
