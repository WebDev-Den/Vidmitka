import Link from "next/link";
import { PageIntro } from "@/components/page-intro";
import { ScheduleDayNotice } from "@/components/schedule-day-notice";
import { StudentImportForm } from "@/components/private/student-import-form";
import { requireTeacher } from "@/lib/auth/session";
import { listJournalLessons, listJournalStudents } from "@/lib/attendance/repository";
import { isJournalDate, kyivMinute, suggestedLessonId } from "@/lib/attendance/rules";
import { formatMinute } from "@/lib/class-periods/rules";
import { formatWeekTypeLabel, getDateKeyInTimeZone } from "@/lib/schedule-week/rules";
import { JournalForm } from "./journal-form";

export default async function JournalPage({ searchParams }: {
  searchParams: Promise<{ date?: string; lesson?: string }>;
}) {
  const teacher = await requireTeacher();
  const params = await searchParams;
  const now = new Date();
  const today = getDateKeyInTimeZone(now);
  const invalidDate = params.date !== undefined && (typeof params.date !== "string" || !isJournalDate(params.date));
  const date = !invalidDate && params.date ? params.date : today;
  const { lessons, weekType, day } = await listJournalLessons(teacher.id, date);
  const scheduled = lessons.filter((lesson) => !lesson.archived);
  const suggestedKey = suggestedLessonId(scheduled.length ? scheduled : lessons, date === today ? kyivMinute(now) : 0);
  const selected = lessons.find((lesson) => lesson.key === params.lesson)
    ?? lessons.find((lesson) => lesson.key === suggestedKey);
  const students = selected ? await listJournalStudents(teacher.id, selected) : [];
  return (
    <section className="journal-page">
      <PageIntro eyebrow="КАБІНЕТ ВИКЛАДАЧА" title="Журнал занять" description="Заняття за розкладом і відвідування студентів. Відмітки зберігаються окремо для кожної дати та пари."
        actions={<Link className="button button-light" href="/dashboard/import-schedule">Імпортувати розклад</Link>} />
      {invalidDate && <p className="notice" role="alert">Некоректна дата. Показано сьогоднішні заняття.</p>}
      <form method="get" className="lesson-editor">
        <label>Дата заняття<input type="date" name="date" defaultValue={date} required /></label>
        <button className="button button-light" type="submit">Показати заняття</button>
        <p className="journal-wide">{weekType ? formatWeekTypeLabel(weekType) : "Адміністратор ще не встановив дату чисельника. Показано лише заняття обох тижнів та збережені журнали."}</p>
      </form>
      {day && <ScheduleDayNotice day={day} />}
      {lessons.length > 0 ? <form method="get" className="lesson-editor" key={date}>
        <input type="hidden" name="date" value={date} />
        <label>Заняття за розкладом
          <select name="lesson" defaultValue={selected?.key}>
            {lessons.map((lesson) => <option key={lesson.key} value={lesson.key}>
              {lesson.periodNumber} пара · {formatMinute(lesson.startMinute)}–{formatMinute(lesson.endMinute)} · {lesson.subjectName} · {lesson.lessonTypeName ?? "Тип не вказано"} · {lesson.roomName}{lesson.archived ? " · Архів" : ""}
            </option>)}
          </select>
        </label>
        <button className="button button-light" type="submit">Відкрити журнал</button>
      </form> : <div className="empty-state"><h2>На цю дату занять немає</h2><p>Оберіть іншу дату або імпортуйте власний розклад.</p></div>}
      {selected && <>
        <h2>{selected.subjectName} · {selected.periodNumber} пара · {selected.roomName}</h2>
        <p>{selected.lessonTypeName ?? "Тип не вказано"}</p>
        {selected.version > 0 && <p role="status">Журнал збережено · версія {selected.version}. Нижче показано збережені відмітки.</p>}
        {selected.archived && <p className="notice">Збережений журнал. Заняття вже відсутнє в актуальному розкладі; історію збережено.</p>}
        {!selected.archived && selected.lessonId && <StudentImportForm key={selected.key} lessonId={selected.lessonId} />}
        {students.length && day ? <JournalForm key={`${selected.key}:${date}:${selected.version}:${day.token}:${students.map((student) => student.studentId).join(",")}`}
          students={students} date={date} lessonKey={selected.key} version={selected.version} calendarToken={day.token} future={date > today} />
          : <div className="notice"><p>Для цього заняття список студентів порожній. Імпортуйте CSV/JSON або відкрийте <Link href="/dashboard/my-lessons">«Мої заняття»</Link> → «Додати студентів». Для занять зі списком усього предмета використовуйте <Link href="/dashboard/students">«Мої студенти»</Link>.</p></div>}
      </>}
    </section>
  );
}
