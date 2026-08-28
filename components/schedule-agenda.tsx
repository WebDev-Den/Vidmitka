import { CalendarDays, MapPin, UserRound, Users } from "lucide-react";
import { LessonTypeBadge } from "@/components/lesson-type-badge";
import { formatMinute } from "@/lib/class-periods/rules";
import { groupScheduleLessons } from "@/lib/schedule-calendar/presentation";
import type { ScheduledLesson } from "@/lib/schedule-calendar/schedule";
import { formatWeekTypeLabel } from "@/lib/schedule-week/rules";
import styles from "./schedule-calendar.module.css";

export function ScheduleAgenda({ lessons, isPreview }: { lessons: readonly ScheduledLesson[]; isPreview: boolean }) {
  const groups = groupScheduleLessons(lessons);
  if (!groups.length) return <div className={styles.empty}>
    <CalendarDays size={26} aria-hidden="true" />
    <h3>{isPreview ? "Для цього дня й типу тижня занять немає" : "На цю дату занять немає"}</h3>
    <p>Виберіть інший день у календарі або перемкніть чисельник / знаменник.</p>
  </div>;

  return <ol className={styles.agenda} aria-label="Заняття обраного дня">
    {groups.map((group) => <li key={group.key} className={styles.period}>
      <div className={styles.periodTime}>
        <strong>{group.number} пара</strong>
        <span>{formatMinute(group.startMinute)}–{formatMinute(group.endMinute)}</span>
      </div>
      <ul className={styles.lessons}>
        {group.lessons.map((lesson) => <li key={lesson.id} className={styles.lesson}>
          <div className={styles.lessonHeading}>
            <h3>{lesson.subjectName}</h3>
            <LessonTypeBadge name={lesson.lessonTypeName} color={lesson.lessonTypeColor} />
          </div>
          <div className={styles.lessonMeta}>
            <span><UserRound size={15} aria-hidden="true" /><span className="sr-only">Викладач: </span>{lesson.teacherName}</span>
            <span><MapPin size={15} aria-hidden="true" />Ауд. {lesson.roomName}</span>
          </div>
          <div className={styles.lessonFooter}>
            <span><Users size={14} aria-hidden="true" /><span className="sr-only">Групи: </span>{lesson.groupNames.join(", ") || "Групи не вказані"}</span>
            <span>{lesson.weekType === "both" ? "Обидва тижні" : formatWeekTypeLabel(lesson.weekType)}</span>
          </div>
        </li>)}
      </ul>
    </li>)}
  </ol>;
}
