"use client";

import { MapPin, UserRound, UsersRound } from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";

import { LessonTypeBadge } from "@/components/lesson-type-badge";
import { periodColorForeground } from "@/lib/class-periods/colors";
import { formatMinute } from "@/lib/class-periods/rules";
import { getDayTimeline, type TimelinePeriod } from "@/lib/class-periods/timeline";
import { buildPeriodScheduleColumns } from "@/lib/schedule-calendar/presentation";
import type { ScheduledLesson } from "@/lib/schedule-calendar/schedule";
import { formatWeekTypeLabel } from "@/lib/schedule-week/rules";

import styles from "./home-schedule-board.module.css";

export function HomePeriodGrid({
  initialNow,
  lessons,
  periods,
  selectedDate,
}: {
  initialNow: number;
  lessons: readonly ScheduledLesson[];
  periods: readonly TimelinePeriod[];
  selectedDate: string;
}) {
  const [now, setNow] = useState(initialNow);

  useEffect(() => {
    const update = () => setNow(Date.now());
    const updateWhenVisible = () => { if (!document.hidden) update(); };
    update();
    const interval = window.setInterval(updateWhenVisible, 30_000);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", updateWhenVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", updateWhenVisible);
    };
  }, []);

  const columns = useMemo(() => buildPeriodScheduleColumns(periods, lessons), [periods, lessons]);
  const timeline = getDayTimeline(periods, new Date(now));
  const currentPeriodNumber = timeline.date === selectedDate && timeline.currentSegment?.kind === "period"
    ? timeline.currentSegment.number
    : null;

  if (!columns.length) {
    return <div className={styles.noPeriods} role="status">
      Активні пари ще не налаштовані.
    </div>;
  }

  return <>
    <p className={styles.scrollHint}>Проведіть убік, щоб переглянути всі пари.</p>
    <div className={styles.gridScroll} tabIndex={0} role="region" aria-label="Денний розклад за номерами пар">
      <ol
        className={styles.grid}
        style={{
          "--period-count": columns.length,
          "--grid-min-width": `${columns.length * 150}px`,
          "--mobile-grid-min-width": `${columns.length * 200}px`,
        } as CSSProperties}
      >
        {columns.map(({ period, lessons: periodLessons }) => {
          const isCurrent = currentPeriodNumber === period.number;
          return <li
            key={period.id}
            className={`${styles.column}${isCurrent ? ` ${styles.current}` : ""}`}
            aria-current={isCurrent ? "time" : undefined}
          >
            <header className={styles.periodHeader} style={{ borderTopColor: period.color }}>
              <div className={styles.periodTitle}>
                <span
                  className={styles.periodNumber}
                  style={{ backgroundColor: period.color, color: periodColorForeground(period.color) }}
                >
                  {period.number}
                </span>
                <span>{period.number} пара</span>
              </div>
              <time>{formatMinute(period.startMinute)}–{formatMinute(period.endMinute)}</time>
              {isCurrent ? <strong className={styles.nowBadge}>Зараз</strong> : null}
            </header>

            {periodLessons.length ? <ul className={styles.lessonList}>
              {periodLessons.map((lesson) => <li key={lesson.id} className={styles.lesson}>
                <div className={styles.lessonHeading}>
                  <h3>{lesson.subjectName}</h3>
                  <LessonTypeBadge name={lesson.lessonTypeName} color={lesson.lessonTypeColor} />
                </div>
                <p className={styles.teacher}>
                  <UserRound size={15} aria-hidden="true" />
                  <span><span className="sr-only">Викладач: </span>{lesson.teacherName}</span>
                </p>
                <div className={styles.lessonMeta}>
                  <span><MapPin size={14} aria-hidden="true" />Ауд. {lesson.roomName}</span>
                  <span><UsersRound size={14} aria-hidden="true" />{lesson.groupNames.join(", ") || "Групи не вказані"}</span>
                </div>
                <small>{lesson.weekType === "both" ? "Щотижня" : formatWeekTypeLabel(lesson.weekType)}</small>
              </li>)}
            </ul> : <div className={styles.emptySlot}>
              <span aria-hidden="true">—</span>
              <p>Занять немає</p>
            </div>}
          </li>;
        })}
      </ol>
    </div>
  </>;
}
