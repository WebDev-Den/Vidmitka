import { PageIntro } from "@/components/page-intro";
import { listSubjects } from "@/lib/subjects/repository";

import { SubjectManager } from "./subject-manager";

export default async function SubjectsPage() {
  const subjects = await listSubjects();

  return (
    <section className="management-page">
      <PageIntro
        eyebrow="ДОВІДНИКИ"
        title="Навчальні предмети"
        description="Активні предмети доступні викладачам для формування власних списків студентів."
      />
      <SubjectManager subjects={subjects} />
    </section>
  );
}
