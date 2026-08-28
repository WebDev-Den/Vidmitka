import Link from "next/link";
import { notFound } from "next/navigation";
import { PageIntro } from "@/components/page-intro";
import { requireAppUser } from "@/lib/auth/session";
import { listGroupStudents, listStudentGroups } from "@/lib/groups/repository";
import { getEditableLessonRoster } from "@/lib/lessons/roster";
import { LessonStudentsForm } from "./student-form";

export default async function LessonStudentsPage({ params }: { params: Promise<{ lessonId: string }> }) {
  const actor = await requireAppUser();
  const { lessonId } = await params;
  const roster = await getEditableLessonRoster(actor.id, lessonId);
  if (!roster) notFound();
  const [groups, students] = await Promise.all([listStudentGroups(), listGroupStudents()]);
  return <section className="management-page">
    <PageIntro eyebrow="СТУДЕНТИ ЗАНЯТТЯ" title={roster.subjectName}
      description="Додайте студентів зараз або поверніться пізніше. Наявний розклад і збережені відмітки не змінюються."
      actions={<div className="page-actions">
        <Link className="button button-light" href="/dashboard/my-lessons">До моїх занять</Link>
        <Link className="button button-light" href="/dashboard/students">Створити студента або групу</Link>
      </div>} />
    <LessonStudentsForm lessonId={roster.id} groups={groups} students={students} existingStudentIds={roster.studentIds} />
  </section>;
}
