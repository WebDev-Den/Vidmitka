import Link from "next/link";
import { notFound } from "next/navigation";
import { PageIntro } from "@/components/page-intro";
import { requireAppUser } from "@/lib/auth/session";
import { listStaffAccounts } from "@/lib/auth/repository";
import { listClassPeriods } from "@/lib/class-periods/repository";
import { listSubjects } from "@/lib/subjects/repository";
import { listRooms } from "@/lib/rooms/repository";
import { listLessonTypes } from "@/lib/lesson-types/repository";
import { listGroupStudents, listStudentGroups } from "@/lib/groups/repository";
import { getLessonCopySource } from "@/lib/lessons/copy";
import { prepareLessonCopy } from "@/lib/lessons/copy-draft";
import { LessonForm } from "./lesson-form";

export default async function NewLessonPage({ searchParams }: { searchParams: Promise<{ copy?: string | string[] }> }) {
  const user = await requireAppUser();
  const { copy } = await searchParams;
  if (copy !== undefined && (typeof copy !== "string" || !/^[1-9]\d{0,17}$/u.test(copy))) notFound();
  const isAdministrator = user.role === "administrator";
  const [periods, subjects, rooms, groups, students, accounts, lessonTypes, source] = await Promise.all([
    listClassPeriods({ activeOnly: true }), listSubjects({ activeOnly: true }), listRooms({ activeOnly: true }),
    listStudentGroups(), listGroupStudents(), isAdministrator ? listStaffAccounts() : Promise.resolve([]),
    listLessonTypes({ activeOnly: true }),
    copy ? getLessonCopySource(user.id, copy) : Promise.resolve(null),
  ]);
  if (copy && !source) notFound();
  const teachers = accounts.filter((teacher) => teacher.approval === "approved").map((teacher) => ({ id: teacher.id, name: teacher.fullName }));
  const prepared = source ? prepareLessonCopy(source, {
    teachers: isAdministrator ? teachers : [{ id: user.id }], subjects, rooms, periods, lessonTypes, students,
  }) : null;
  return <section className="management-page">
    <PageIntro eyebrow={isAdministrator ? "АДМІНІСТРУВАННЯ" : "КАБІНЕТ ВИКЛАДАЧА"} title={source ? "Копіювати заняття" : "Створити заняття"}
      description={source ? `Копія «${source.subjectName}». Змініть пару або інші параметри й збережіть нове заняття.` : "Оберіть параметри розкладу, групи та студентів для цієї пари. Система перевірить конфлікти перед збереженням."}
      actions={source ? <Link className="button button-light" href="/dashboard/my-lessons">До моїх занять</Link> : undefined} />
    {source && <p className="notice">Параметри оригіналу й збережені відмітки не змінюються. Перенесено лише поточний активний склад — {prepared!.defaults.studentIds.length} студентів; його можна змінити нижче.
      {source.rosterMode === "subject" && " Копія матиме окремий список. Оригінал і далі використовує список предмета: нові студенти цього предмета з’являтимуться в ньому за чинними правилами."}</p>}
    {!!prepared?.unavailableFields.length && <p className="notice" role="alert">Потрібно вибрати активні значення: {prepared.unavailableFields.join(", ")}. Старі значення недоступні.</p>}
    {!!prepared?.omittedStudentCount && <p className="notice" role="alert">Частина студентів уже недоступна. Перевірте склад перед створенням копії.</p>}
    <LessonForm key={source?.id ?? "new"} defaults={prepared?.defaults} subjects={subjects.map(({ id, name }) => ({ id, name }))} rooms={rooms.map(({ id, name }) => ({ id, name }))}
      periods={periods.map(({ id, label }) => ({ id, name: label }))} lessonTypes={lessonTypes.map(({ id, name }) => ({ id, name }))} groups={groups} students={students}
      teachers={teachers} isAdministrator={isAdministrator} currentUserId={user.id} />
  </section>;
}
