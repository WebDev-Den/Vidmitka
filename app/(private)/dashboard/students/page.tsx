import { PageIntro } from "@/components/page-intro";
import { requireTeacher } from "@/lib/auth/session";
import { listTeacherStudents } from "@/lib/students/repository";
import { listSubjects } from "@/lib/subjects/repository";

import { StudentManager } from "./student-manager";

export default async function StudentsPage() {
  const teacher = await requireTeacher();
  const [subjects, students] = await Promise.all([
    listSubjects({ activeOnly: true }),
    listTeacherStudents(teacher.id),
  ]);

  return (
    <section>
      <PageIntro
        eyebrow="КАБІНЕТ ВИКЛАДАЧА"
        title="Мої студенти"
        description="Додавайте студентів до власних предметів. Завершення семестру не видаляє ці списки."
      />
      <StudentManager subjects={subjects} students={students} />
    </section>
  );
}
