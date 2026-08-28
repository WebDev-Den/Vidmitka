import { PageIntro } from "@/components/page-intro";
import { requireTeacher } from "@/lib/auth/session";
import { listClassPeriods } from "@/lib/class-periods/repository";
import { listRooms } from "@/lib/rooms/repository";
import { listSubjects } from "@/lib/subjects/repository";
import { listLessonTypes } from "@/lib/lesson-types/repository";

import { ImportScheduleForm } from "./import-schedule-form";

export default async function ImportSchedulePage() {
  await requireTeacher();
  const [subjects, rooms, periods, lessonTypes] = await Promise.all([
    listSubjects({ activeOnly: true }),
    listRooms({ activeOnly: true }),
    listClassPeriods({ activeOnly: true }),
    listLessonTypes({ activeOnly: true }),
  ]);

  return (
    <section className="management-page">
      <PageIntro
        eyebrow="КАБІНЕТ ВИКЛАДАЧА"
        title="Імпорт розкладу"
        description="Завантажте власні заняття з JSON або CSV. Перед збереженням система перевірить довідники та всі конфлікти."
      />
      <ImportScheduleForm
        subjects={subjects.map((subject) => subject.name)}
        rooms={rooms.map((room) => room.name)}
        periods={periods.map((period) => period.label)}
        lessonTypes={lessonTypes.map((type) => type.name)}
      />
    </section>
  );
}
