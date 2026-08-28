import { PageIntro } from "@/components/page-intro";
import { requireAdministrator } from "@/lib/auth/session";
import { listLessonTypes } from "@/lib/lesson-types/repository";
import { LessonTypeManager } from "./type-manager";

export default async function LessonTypesPage() {
  await requireAdministrator();
  const types = await listLessonTypes();
  return <section className="management-page">
    <PageIntro eyebrow="АДМІНІСТРУВАННЯ" title="Типи занять"
      description="Лекції, практичні, лабораторні та власні типи. Деактивація забороняє вибір для нових занять, але зберігає наявний розклад." />
    <LessonTypeManager types={types} />
  </section>;
}
