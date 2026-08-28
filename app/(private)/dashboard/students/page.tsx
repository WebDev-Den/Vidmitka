import { PageIntro } from "@/components/page-intro";
import { StudentImportForm } from "@/components/private/student-import-form";
import { requireTeacher } from "@/lib/auth/session";
import { listTeacherStudents } from "@/lib/students/repository";
import { listSubjects } from "@/lib/subjects/repository";
import { listStudentGroups } from "@/lib/groups/repository";

import { StudentManager } from "./student-manager";

export default async function StudentsPage() {
  const teacher = await requireTeacher();
  const [subjects, students, groups] = await Promise.all([
    listSubjects({ activeOnly: true }),
    listTeacherStudents(teacher.id),
    listStudentGroups(),
  ]);

  return (
    <section className="management-page">
      <PageIntro
        eyebrow="КАБІНЕТ ВИКЛАДАЧА"
        title="Мої студенти"
        description="Додавайте студентів до власних предметів. Завершення семестру не видаляє ці списки."
      />
      <StudentImportForm subjects={subjects} />
      <StudentManager subjects={subjects} students={students} groups={groups} />
    </section>
  );
}
