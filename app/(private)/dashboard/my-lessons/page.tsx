import { CalendarPlus, Plus, Upload } from "lucide-react";
import Link from "next/link";

import { PageIntro } from "@/components/page-intro";
import { EmptyState } from "@/components/private/empty-state";
import { requireTeacher } from "@/lib/auth/session";
import { listTeacherLessons } from "@/lib/lessons/repository";

const DAY_LABELS: Record<number, string> = {
  1: "Понеділок",
  2: "Вівторок",
  3: "Середа",
  4: "Четвер",
  5: "П’ятниця",
  6: "Субота",
  7: "Неділя",
};

const WEEK_LABELS = {
  numerator: "Чисельник",
  denominator: "Знаменник",
  both: "Обидва тижні",
} as const;

export default async function MyLessonsPage() {
  const teacher = await requireTeacher();
  const lessons = await listTeacherLessons(teacher.id);

  return (
    <section>
      <PageIntro
        eyebrow="КАБІНЕТ ВИКЛАДАЧА"
        title="Мої заняття"
        description="Створені вами заняття та їхній поточний стан."
        actions={
          <div className="page-actions">
            <Link className="button button-light" href="/dashboard/import-schedule">
              <Upload size={17} /> Імпортувати
            </Link>
            <Link className="button button-primary" href="/dashboard/lessons/new">
              <Plus size={17} /> Створити заняття
            </Link>
          </div>
        }
      />
      {lessons.length === 0 ? (
        <EmptyState
          icon={CalendarPlus}
          title="Занять ще немає"
          description="Створіть заняття вручну або імпортуйте власний розклад із JSON чи CSV."
        />
      ) : (
        <div className="schedule-table-wrap">
          <table className="schedule-table">
            <thead>
              <tr>
                <th>День</th>
                <th>Пара</th>
                <th>Предмет</th>
                <th>Аудиторія</th>
                <th>Тиждень</th>
              </tr>
            </thead>
            <tbody>
              {lessons.map((lesson) => (
                <tr key={lesson.id}>
                  <td>{DAY_LABELS[lesson.dayOfWeek]}</td>
                  <td>{lesson.periodNumber} · {lesson.periodTime}</td>
                  <td><strong>{lesson.subjectName}</strong></td>
                  <td>{lesson.roomName}</td>
                  <td>{WEEK_LABELS[lesson.weekType]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
