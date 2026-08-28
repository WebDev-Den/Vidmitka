"use client";

import { useEffect, useState } from "react";

import { periodColorForeground } from "@/lib/class-periods/colors";
import { formatMinute } from "@/lib/class-periods/rules";
import { getDayTimeline, type DayTimeline, type TimelinePeriod, type TimelineSegment } from "@/lib/class-periods/timeline";

function segmentLabel(segment: TimelineSegment): string {
  return segment.kind === "period" ? `${segment.number} пара` : "Перерва";
}

function currentStatus(timeline: DayTimeline): string {
  if (timeline.state === "empty") return "Активні пари ще не налаштовані.";
  if (timeline.state === "before") return `Початок пар за сіткою — о ${formatMinute(timeline.startMinute!)}`;
  if (timeline.state === "after") return "Пари за сіткою на сьогодні завершені";
  const current = timeline.currentSegment!;
  const label = current.kind === "period" ? `Час ${current.number} пари` : "Перерва";
  return `${label} · до ${formatMinute(current.endMinute)}`;
}

export function DayTimeline({ periods, initialNow }: {
  periods: readonly TimelinePeriod[];
  initialNow: number;
}) {
  // The first browser render uses exactly the server timestamp (no hydration mismatch).
  const [now, setNow] = useState(initialNow);

  useEffect(() => {
    const update = () => setNow(Date.now());
    const onVisible = () => { if (!document.hidden) update(); };
    update();
    const interval = window.setInterval(onVisible, 1000);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const timeline = getDayTimeline(periods, new Date(now));
  const status = currentStatus(timeline);
  const dateLabel = timeline.date.split("-").reverse().join(".");

  return (
    <section className="day-timeline" aria-label="Сітка пар на сьогодні">
      <div className="day-timeline-heading">
        <div className="day-timeline-title">
          <strong>Сітка пар</strong>
          <span>Сьогодні · {dateLabel}</span>
        </div>
        <time className="day-timeline-clock" dateTime={new Date(now).toISOString()}>
          {timeline.time}
        </time>
      </div>

      {timeline.segments.length ? (
        <>
          <div className="day-timeline-track" role="progressbar" aria-label="Поточний час у сітці пар"
            aria-valuemin={0} aria-valuemax={100} aria-valuenow={Number(timeline.positionPercent.toFixed(2))}
            aria-valuetext={`${timeline.time}. ${status}`}>
            <div className="day-timeline-segments" aria-hidden="true">
              {timeline.segments.map((segment) => (
                <span key={segment.id}
                  className={`day-timeline-segment is-${segment.kind}`}
                  title={`${segmentLabel(segment)} · ${formatMinute(segment.startMinute)}–${formatMinute(segment.endMinute)}`}
                  style={{
                    left: `${segment.startPercent}%`, width: `${segment.widthPercent}%`,
                    ...(segment.kind === "period" ? {
                      backgroundColor: segment.color, color: periodColorForeground(segment.color),
                    } : {}),
                  }}>
                  {segment.kind === "period" ? <span className="day-timeline-number">{segment.number}</span> : null}
                </span>
              ))}
            </div>
            <span className="day-timeline-marker" style={{ left: `${timeline.positionPercent}%` }} aria-hidden="true" />
          </div>

          <div className="day-timeline-footer">
            <p className="day-timeline-status">{status}</p>
            <details className="day-timeline-details">
              <summary>Час пар і перерв</summary>
              <ol>
                {timeline.segments.map((segment) => (
                  <li key={segment.id} aria-current={timeline.currentSegment?.id === segment.id ? "time" : undefined}>
                    <span className={`period-color-swatch${segment.kind === "break" ? " is-break" : ""}`}
                      style={segment.kind === "period" ? { backgroundColor: segment.color } : undefined} aria-hidden="true" />
                    <span>
                      <strong>{segmentLabel(segment)}</strong>
                      <span>{formatMinute(segment.startMinute)}–{formatMinute(segment.endMinute)}</span>
                    </span>
                  </li>
                ))}
              </ol>
              <p>Це загальна сітка дзвінків. Заняття на потрібну дату дивіться в розкладі.</p>
            </details>
          </div>
        </>
      ) : <p className="day-timeline-status">{status}</p>}
    </section>
  );
}
