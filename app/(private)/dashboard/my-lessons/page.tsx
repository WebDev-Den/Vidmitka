import { CalendarPlus, Plus, Upload } from "lucide-react";
import Link from "next/link";

import { PageIntro } from "@/components/page-intro";
import { LessonTypeBadge } from "@/components/lesson-type-badge";
import { EmptyState } from "@/components/private/empty-state";
import { ManagementTable } from "@/components/private/management-table";
import { requireTeacher } from "@/lib/auth/session";
import { listTeacherLessons } from "@/lib/lessons/repository";
import { listLessonTypes } from "@/lib/lesson-types/repository";
import { LessonTypePicker } from "./lesson-type-picker";
import { LessonRowLink } from "./lesson-row-link";
import styles from "./my-lessons.module.css";

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
  const [lessons, types] = await Promise.all([listTeacherLessons(teacher.id), listLessonTypes({ activeOnly: true })]);
  const typeChoices = types.map(({ id, name }) => ({ id, name }));

  return (
    <section className="management-page">
      <PageIntro
        eyebrow="КАБІНЕТ ВИКЛАДАЧА"
        title="Мої заняття"
        description="Ваші заняття. Натисніть на тип, щоб змінити його, або скопіюйте заняття на іншу пару."
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
        <div className={styles.list}>
        <ManagementTable caption="Мої заняття" columns={["День", "Пара / час", "Предмет / тип", "Аудиторія", "Тиждень", "Студенти / групи", "Дії"]} minWidth={1080}>
            <tbody>
              {lessons.map((lesson) => (
                <tr key={lesson.id}>
                  <td>{DAY_LABELS[lesson.dayOfWeek]}</td>
                  <td><strong className={styles.period}>{lesson.periodNumber} пара</strong><span className={`${styles.secondary} ${styles.time}`}>{lesson.periodTime}</span></td>
                  <th scope="row"><strong className={styles.subject}>{lesson.subjectName}</strong>
                    {teacher.role === "administrator" || lesson.createdByUserId === teacher.id
                      ? <LessonTypePicker lessonId={lesson.id} currentTypeId={lesson.lessonTypeId} currentTypeName={lesson.lessonTypeName} currentTypeColor={lesson.lessonTypeColor} types={typeChoices} subjectName={lesson.subjectName} />
                      : <span className={styles.secondary}><LessonTypeBadge name={lesson.lessonTypeName} color={lesson.lessonTypeColor} /> · змінює адміністратор</span>}
                  </th>
                  <td>{lesson.roomName}</td>
                  <td><span className={styles.week}>{WEEK_LABELS[lesson.weekType]}</span></td>
                  <td><span>{lesson.studentCount ? `Студентів: ${lesson.studentCount}` : "Без студентів"}</span>
                    {!!lesson.groupNames.length && <span className={styles.secondary}>{lesson.groupNames.join(", ")}</span>}
                    <span className={styles.secondary}>{lesson.rosterMode === "selected" ? "Окремий список" : "Список предмета"}</span>
                  </td>
                  <td><div className={styles.actions}>
                    <LessonRowLink lessonId={lesson.id} subjectName={lesson.subjectName} kind="copy" />
                    {lesson.rosterMode === "selected" && <LessonRowLink lessonId={lesson.id} subjectName={lesson.subjectName} kind="students" />}
                  </div></td>
                </tr>
              ))}
            </tbody>
        </ManagementTable>
        </div>
      )}
    </section>
  );
}
