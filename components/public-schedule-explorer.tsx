import Link from "next/link";
import type { CSSProperties } from "react";

import type { PublicGroup, PublicScheduleDay } from "@/lib/schedule-v2/public-schedule";

import styles from "./public-schedule-explorer.module.css";

const CHANGE_LABELS: Record<string, string> = {
  move: "Перенесено", reschedule: "Змінено час", room_change: "Змінено аудиторію",
  teacher_change: "Заміна викладача", discipline_change: "Заміна дисципліни", type_change: "Змінено тип",
  cancel: "Скасовано", one_time: "Разове заняття",
};

function dateLabel(date: string): string {
  return new Intl.DateTimeFormat("uk-UA", { weekday: "long", day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}

export function PublicScheduleExplorer({ groups, days, selectedGroupId, view }: {
  groups: readonly PublicGroup[]; days: readonly PublicScheduleDay[]; selectedGroupId: string; view: "day" | "week";
}) {
  const selectedDate = days[0]?.date ?? "";
  const query = new URLSearchParams({ date: selectedDate, ...(selectedGroupId ? { group: selectedGroupId } : {}) });
  return <main className={styles.page}>
    <header className={styles.intro}><span className="eyebrow">ПУБЛІЧНИЙ ДОСТУП</span><h1>Розклад занять</h1>
      <p>Оберіть групу, дату та формат перегляду. Винятки вже враховані в результаті.</p>
      {days[0] ? <span className={styles.weekBadge}>{days[0].weekType === "numerator" ? "Перший навчальний тиждень" : "Другий навчальний тиждень"}{!days[0].weekConfigured ? " · базову дату ще не налаштовано" : ""}</span> : null}
    </header>
    <form className={styles.controls} method="get">
      <label>Група<select name="group" defaultValue={selectedGroupId} required><option value="" disabled>Оберіть групу</option>
        {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
      <label>Дата<input type="date" name="date" defaultValue={selectedDate} required /></label>
      <input type="hidden" name="view" value={view} /><button className="button button-primary">Показати</button>
      <nav className={styles.mode} aria-label="Формат розкладу"><Link href={`/schedule?${query}&view=day`} aria-current={view === "day" ? "page" : undefined}>День</Link>
        <Link href={`/schedule?${query}&view=week`} aria-current={view === "week" ? "page" : undefined}>Тиждень</Link></nav>
    </form>
    <div className={styles.days}>{days.map((day) => <section className={styles.day} key={day.date}>
      <header className={styles.dayHeader}><h2>{dateLabel(day.date)}</h2><span>{day.weekType === "numerator" ? "Перший тиждень" : "Другий тиждень"}</span></header>
      {day.items.length ? <div className={styles.items}>{day.items.map((item) => <article key={`${item.id}:${day.date}`} className={`${styles.item} ${item.cancelled ? styles.cancelled : ""}`}
        style={{ "--lesson-color": item.lessonTypeColor } as CSSProperties}>
        <div className={styles.period}><strong>{item.periodNumber} пара</strong><small>{item.startTime}–{item.endTime}</small></div>
        <div className={styles.main}><strong>{item.discipline}</strong><span className={styles.type}>{item.lessonType}</span><small>{item.groups.join(", ")}</small></div>
        <div className={styles.meta}><span>{item.teachers.join(", ") || "Викладача не вказано"}</span><small>{item.rooms.join(", ") || "Дистанційно / аудиторію не вказано"}</small></div>
        <div className={styles.meta}>{item.changeKind ? <span className={styles.change}>{CHANGE_LABELS[item.changeKind] ?? "Змінено"}</span> : null}
          {item.changeReason ? <small>{item.changeReason}</small> : null}{item.originalDate ? <small>Початкова дата: {item.originalDate.split("-").reverse().join(".")}</small> : null}{item.note ? <small>{item.note}</small> : null}</div>
      </article>)}</div> : <p className={styles.empty}>{selectedGroupId ? "Для цієї групи занять немає." : "Оберіть групу, щоб переглянути її розклад."}</p>}
    </section>)}</div>
  </main>;
}
