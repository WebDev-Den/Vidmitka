import { PageIntro } from "@/components/page-intro";
import { requireAppUser } from "@/lib/auth/session";
import { listTeacherAccounts } from "@/lib/auth/repository";
import { listClassPeriods } from "@/lib/class-periods/repository";
import { listSubjects } from "@/lib/subjects/repository";
import { listRooms } from "@/lib/rooms/repository";
import { listGroupStudents, listStudentGroups } from "@/lib/groups/repository";
import { LessonForm } from "./lesson-form";

export default async function NewLessonPage() {
  const user = await requireAppUser();
  const isAdministrator = user.role === "administrator";
  const [periods, subjects, rooms, groups, students, accounts] = await Promise.all([
    listClassPeriods({ activeOnly: true }), listSubjects({ activeOnly: true }), listRooms({ activeOnly: true }),
    listStudentGroups(), listGroupStudents(), isAdministrator ? listTeacherAccounts() : Promise.resolve([]),
  ]);
  const teachers = accounts.filter((teacher) => teacher.approval === "approved").map((teacher) => ({ id: teacher.id, name: teacher.fullName }));
  return <section>
    <PageIntro eyebrow={isAdministrator ? "АДМІНІСТРУВАННЯ" : "КАБІНЕТ ВИКЛАДАЧА"} title="Створити заняття"
      description="Оберіть параметри розкладу, групи та студентів для цієї пари. Система перевірить конфлікти перед збереженням." />
    <LessonForm subjects={subjects.map(({ id, name }) => ({ id, name }))} rooms={rooms.map(({ id, name }) => ({ id, name }))}
      periods={periods.map(({ id, label }) => ({ id, name: label }))} groups={groups} students={students}
      teachers={teachers} isAdministrator={isAdministrator} />
  </section>;
}
