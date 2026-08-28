import { describe, expect, it } from "vitest";

import { getDayTimeline, type TimelinePeriod } from "./timeline";

const periods: readonly TimelinePeriod[] = [
  { id: "1", number: 1, startMinute: 480, endMinute: 560, isActive: true, color: "#0F766E" },
  { id: "2", number: 2, startMinute: 575, endMinute: 655, isActive: true, color: "#48C5B5" },
];

describe("шкала пар і перерв", () => {
  it("відображає часові пропорції та секунди поточної пари за київським часом", () => {
    // 08:40:30 у Києві; день 08:00–10:55, перерва 09:20–09:35.
    const timeline = getDayTimeline(periods, new Date("2026-08-28T05:40:30Z"));
    expect(timeline).toMatchObject({
      date: "2026-08-28", time: "08:40:30", state: "period",
      startMinute: 480, endMinute: 655,
      currentSegment: { kind: "period", number: 1, color: "#0F766E" },
    });
    expect(timeline.positionPercent).toBeCloseTo(23.142857, 5);
    expect(timeline.segments).toHaveLength(3);
    expect(timeline.segments[0].widthPercent).toBeCloseTo(45.714286, 5);
    expect(timeline.segments[1]).toMatchObject({ kind: "break", startMinute: 560, endMinute: 575 });
    expect(timeline.segments[1].widthPercent).toBeCloseTo(8.571429, 5);
    expect(timeline.segments[2].startPercent).toBeCloseTo(54.285714, 5);
  });

  it.each([
    ["04:59:59", "before", null, 0],
    ["05:00:00", "period", "period", 0],
    ["06:20:00", "break", "break", 45.714286],
    ["06:34:59", "break", "break", 54.276190],
    ["06:35:00", "period", "period", 54.285714],
    ["07:55:00", "after", null, 100],
    ["18:00:00", "after", null, 100],
  ] as const)("коректно обробляє межу %s UTC", (time, state, currentKind, percent) => {
    const timeline = getDayTimeline(periods, new Date(`2026-08-28T${time}Z`));
    expect(timeline.state).toBe(state);
    expect(timeline.currentSegment?.kind ?? null).toBe(currentKind);
    expect(timeline.positionPercent).toBeCloseTo(percent, 5);
  });

  it("сортує за часом, не номером, не змінює джерело й не показує неактивні пари", () => {
    const input: TimelinePeriod[] = [
      { ...periods[1], number: 1 }, { ...periods[0], number: 9 },
      { id: "3", number: 3, startMinute: 0, endMinute: 60, isActive: false, color: "#DED9CD" },
    ];
    const timeline = getDayTimeline(input, new Date("2026-08-28T05:40:00Z"));
    expect(timeline.segments.filter((segment) => segment.kind === "period").map((segment) => segment.number))
      .toEqual([9, 1]);
    expect(input.map((period) => period.number)).toEqual([1, 9, 3]);
    expect(timeline.startMinute).toBe(480);
  });

  it("сусідні пари без проміжку не створюють нульову перерву", () => {
    const timeline = getDayTimeline([periods[0], { ...periods[1], startMinute: 560 }], new Date("2026-08-28T06:20:00Z"));
    expect(timeline.segments).toHaveLength(2);
    expect(timeline.currentSegment).toMatchObject({ kind: "period", number: 2 });
  });

  it("наступна київська доба починає шкалу заново", () => {
    const timeline = getDayTimeline(periods, new Date("2026-08-28T21:00:00Z"));
    expect(timeline).toMatchObject({ date: "2026-08-29", time: "00:00:00", state: "before", positionPercent: 0 });
  });

  it("використовує часову зону, а не фіксований UTC-зсув", () => {
    const winter = getDayTimeline(periods, new Date("2026-01-15T06:00:00Z"));
    const summer = getDayTimeline(periods, new Date("2026-08-28T05:00:00Z"));
    expect(winter.time).toBe("08:00:00");
    expect(summer.time).toBe("08:00:00");
    expect(winter.positionPercent).toBe(0);
    expect(summer.positionPercent).toBe(0);
  });

  it("порожня або повністю неактивна сітка не вигадує пар і не дає NaN", () => {
    for (const input of [[], periods.map((period) => ({ ...period, isActive: false }))]) {
      expect(getDayTimeline(input, new Date("2026-08-28T05:00:00Z"))).toMatchObject({
        state: "empty", segments: [], currentSegment: null, positionPercent: 0,
        startMinute: null, endMinute: null,
      });
    }
  });

  it("одна активна пара займає всю шкалу", () => {
    const timeline = getDayTimeline([periods[0]], new Date("2026-08-28T05:40:00Z"));
    expect(timeline.segments).toHaveLength(1);
    expect(timeline.segments[0].widthPercent).toBe(100);
    expect(timeline.positionPercent).toBe(50);
  });
});
