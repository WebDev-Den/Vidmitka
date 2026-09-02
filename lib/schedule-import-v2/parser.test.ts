import { describe, expect, it } from "vitest";

import { analyzeTeacherScheduleJson } from "./parser";

const validLesson = {
  teacher: "  Алексейко   В.О. ",
  date: "2026-09-01",
  dayOfWeek: 2,
  period: 1,
  weekType: "numerator",
  subject: " Штучні  нейронні мережі ",
  room: "1-113",
  groups: ["КІ-25-2ал"],
  lessonType: "Лабораторна",
  substitution: { dayOfWeek: 1, weekType: "numerator" },
};

describe("analyzeTeacherScheduleJson", () => {
  it("normalizes the provided dated lesson shape and builds catalog previews", () => {
    const result = analyzeTeacherScheduleJson(JSON.stringify([validLesson]));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.summary).toEqual({
      totalRows: 1,
      validRows: 1,
      invalidRows: 0,
      duplicateRows: 0,
      teachers: 1,
      disciplines: 1,
      rooms: 1,
      groups: 1,
      lessonTypes: 1,
      warnings: 0,
    });
    expect(result.rows[0]).toMatchObject({
      rowNumber: 1,
      teacherName: "Алексейко В.О.",
      disciplineName: "Штучні нейронні мережі",
      groups: ["КІ-25-2ал"],
      occurrenceDate: "2026-09-01",
      sourceScheduleDay: 1,
      sourceScheduleWeek: "numerator",
    });
    expect(result.rows[0]?.sourceId).toMatch(/^[a-f0-9]{64}$/u);
    expect(result.catalogs.disciplines).toEqual(["Штучні нейронні мережі"]);
  });

  it("uses a stable row key regardless of whitespace and group order", () => {
    const first = analyzeTeacherScheduleJson(JSON.stringify([
      { ...validLesson, groups: ["КН-1", "КН-2"] },
    ]));
    const second = analyzeTeacherScheduleJson(JSON.stringify([
      {
        ...validLesson,
        teacher: "Алексейко В.О.",
        subject: "Штучні нейронні мережі",
        groups: [" КН-2 ", "КН-1"],
      },
    ]));

    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.rows[0]?.sourceId).toBe(second.rows[0]?.sourceId);
  });

  it("keeps valid rows while reporting record-specific validation errors", () => {
    const result = analyzeTeacherScheduleJson(JSON.stringify([
      validLesson,
      { ...validLesson, date: "2026-09-02", dayOfWeek: 2 },
    ]));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toHaveLength(1);
    expect(result.errors).toEqual([
      expect.objectContaining({ rowNumber: 2, code: "date_day_mismatch" }),
    ]);
    expect(result.summary.invalidRows).toBe(1);
  });

  it("deduplicates exact normalized rows and reports the duplicate", () => {
    const result = analyzeTeacherScheduleJson(JSON.stringify([
      validLesson,
      { ...validLesson, groups: [" КІ-25-2ал "] },
    ]));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toHaveLength(1);
    expect(result.summary.duplicateRows).toBe(1);
    expect(result.warnings).toEqual([
      expect.objectContaining({ rowNumber: 2, code: "duplicate_row" }),
    ]);
  });

  it("reports teacher, room and group collisions as preview warnings", () => {
    const result = analyzeTeacherScheduleJson(JSON.stringify([
      validLesson,
      {
        ...validLesson,
        subject: "Інша дисципліна",
        groups: ["КІ-25-2ал"],
        substitution: { dayOfWeek: 2, weekType: "numerator" },
      },
    ]));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings.map((warning) => warning.code)).toEqual(
      expect.arrayContaining(["teacher_conflict", "room_conflict", "group_conflict"]),
    );
  });

  it("rejects malformed JSON and a non-array root", () => {
    expect(analyzeTeacherScheduleJson("{")).toEqual({
      ok: false,
      errors: [expect.objectContaining({ code: "invalid_json" })],
    });
    expect(analyzeTeacherScheduleJson(JSON.stringify({ lessons: [] }))).toEqual({
      ok: false,
      errors: [expect.objectContaining({ code: "invalid_root" })],
    });
  });
});
