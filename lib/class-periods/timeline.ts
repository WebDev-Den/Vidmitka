import { getDateKeyInTimeZone } from "@/lib/schedule-week/rules";

import type { PeriodColor } from "./colors";
import type { ComparableClassPeriod } from "./rules";

export type TimelinePeriod = ComparableClassPeriod & Readonly<{ color: PeriodColor }>;

type SegmentTime = Readonly<{
  id: string;
  startMinute: number;
  endMinute: number;
  startPercent: number;
  widthPercent: number;
}>;

export type TimelineSegment = SegmentTime & (
  | Readonly<{ kind: "period"; number: number; color: PeriodColor }>
  | Readonly<{ kind: "break" }>
);

export type DayTimeline = Readonly<{
  date: string;
  time: string;
  state: "empty" | "before" | "period" | "break" | "after";
  startMinute: number | null;
  endMinute: number | null;
  segments: readonly TimelineSegment[];
  currentSegment: TimelineSegment | null;
  positionPercent: number;
}>;

const clockFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Kyiv", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});

// Input is the validated bell timetable: active periods never overlap or cross midnight.
// The caller supplies time, so the same rules serve SSR, the live view, and deterministic tests.
export function getDayTimeline(periods: readonly TimelinePeriod[], now: Date): DayTimeline {
  const parts = Object.fromEntries(clockFormatter.formatToParts(now).map((part) => [part.type, part.value]));
  const minute = Number(parts.hour) * 60 + Number(parts.minute) + Number(parts.second) / 60;
  const clock = { date: getDateKeyInTimeZone(now), time: `${parts.hour}:${parts.minute}:${parts.second}` };
  const active = periods.filter((period) => period.isActive)
    .sort((a, b) => a.startMinute - b.startMinute || a.number - b.number);

  if (!active.length) {
    return { ...clock, state: "empty", startMinute: null, endMinute: null, segments: [], currentSegment: null, positionPercent: 0 };
  }

  const startMinute = active[0].startMinute;
  const endMinute = active[active.length - 1].endMinute;
  const duration = endMinute - startMinute;
  const segmentTime = (start: number, end: number) => ({
    startMinute: start, endMinute: end,
    startPercent: ((start - startMinute) / duration) * 100,
    widthPercent: ((end - start) / duration) * 100,
  });
  const segments: TimelineSegment[] = [];

  for (let index = 0; index < active.length; index++) {
    const period = active[index];
    const previous = active[index - 1];
    if (previous && previous.endMinute < period.startMinute) {
      segments.push({
        kind: "break", id: `break:${previous.id}:${period.id}`,
        ...segmentTime(previous.endMinute, period.startMinute),
      });
    }
    segments.push({
      kind: "period", id: period.id, number: period.number, color: period.color,
      ...segmentTime(period.startMinute, period.endMinute),
    });
  }

  const currentSegment = segments.find((segment) => segment.startMinute <= minute && minute < segment.endMinute) ?? null;
  return {
    ...clock, startMinute, endMinute, segments, currentSegment,
    state: minute < startMinute ? "before" : minute >= endMinute ? "after" : currentSegment?.kind ?? "break",
    positionPercent: Math.max(0, Math.min(100, ((minute - startMinute) / duration) * 100)),
  };
}
