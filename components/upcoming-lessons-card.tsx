import Link from "next/link";
import { connection } from "next/server";
import { formatMinute } from "@/lib/class-periods/rules";
import { listUpcomingLessons, type UpcomingLesson } from "@/lib/schedule-calendar/upcoming";
import { formatWeekTypeLabel } from "@/lib/schedule-week/rules";

export async function UpcomingLessonsCard() {
  await connection();
  let lessons: UpcomingLesson[];
  try {
    lessons = await listUpcomingLessons(new Date());
  } catch {
    return <section className="schedule-preview" aria-label="Найближчі заняття">
      <h2>Найближчі заняття</h2>
      <p role="status">Не вдалося завантажити розклад. Спробуйте оновити сторінку пізніше.</p>
      <Link href="/schedule">Перейти до розкладу</Link>
    </section>;
  }
  return <section className="schedule-preview" aria-labelledby="upcoming-lessons-heading">
    <div className="preview-heading">
      <div><span>АКТУАЛЬНИЙ РОЗКЛАД</span><h2 id="upcoming-lessons-heading">Найближчі 5 занять</h2></div>
      <span className="preview-week">Київський час</span>
    </div>
    {lessons.length > 0 ? <ol className="preview-list upcoming-list">
      {lessons.map((lesson) => <li className="upcoming-lesson" key={`${lesson.date}:${lesson.id}`}>
        <div className="upcoming-slot">
          <strong>{lesson.periodNumber} пара</strong>
          <span>{formatMinute(lesson.startMinute)}–{formatMinute(lesson.endMinute)}</span>
          {lesson.isCurrent && <span className="upcoming-current">Триває зараз</span>}
        </div>
        <div className="upcoming-details">
          <Link href={`/schedule?date=${lesson.date}`}><strong>{lesson.subjectName}</strong></Link>
          <span>Ауд. {lesson.roomName} · {lesson.teacherName}</span>
          <span className="upcoming-type">{lesson.lessonTypeName ?? "Тип не вказано"}</span>
          <small><time dateTime={lesson.date}>{lesson.date.split("-").reverse().join(".")}</time>
            {lesson.weekType ? ` · ${formatWeekTypeLabel(lesson.weekType)}` : " · Обидва тижні"}
            {lesson.isMakeup ? " · Відпрацювання" : ""}
          </small>
        </div>
      </li>)}
    </ol> : <p className="upcoming-empty">Найближчих занять немає. Вони з’являться після додавання розкладу й налаштування календаря.</p>}
  </section>;
}
