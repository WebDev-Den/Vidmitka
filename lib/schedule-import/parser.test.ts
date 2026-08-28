import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { parseScheduleImport } from "./parser";

describe("parseScheduleImport", () => {
  it("читає власний тип заняття з JSON незалежно від типу тижня", () => {
    const result = parseScheduleImport({ fileName: "schedule.json", content: JSON.stringify([
      { subject: "Математика", room: "101", day: 1, period: 1, weekType: "both", lessonType: "  Індивідуальна   консультація " },
    ]) });
    expect(result).toMatchObject({ ok: true, rows: [{ lessonTypeName: "Індивідуальна консультація", weekType: "both" }] });
  });
  it("читає окремі колонки типу заняття і тижня з CSV", () => {
    expect(parseScheduleImport({ fileName: "schedule.csv", content: "предмет;аудиторія;день;пара;тиждень;тип заняття\nМатематика;101;1;1;Чисельник;Практична" }))
      .toMatchObject({ ok: true, rows: [{ lessonTypeName: "Практична", weekType: "numerator" }] });
  });
  it.each([42, {}, "x".repeat(101), "   "])("відхиляє некоректно переданий тип заняття %#", (lessonType) => {
    expect(parseScheduleImport({ fileName: "schedule.json", content: JSON.stringify([
      { subject: "Математика", room: "101", day: 1, period: 1, weekType: "both", lessonType },
    ]) }).ok).toBe(false);
  });
  it("нормалізує JSON-розклад із українськими значеннями", () => {
    const result = parseScheduleImport({
      fileName: "schedule.json",
      content: JSON.stringify([
        {
          subject: "  Основи   програмування ",
          room: " КН-21 ",
          day: "Понеділок",
          period: 1,
          weekType: "Чисельник",
        },
      ]),
    });

    expect(result).toEqual({
      ok: true,
      rows: [
        {
          rowNumber: 1,
          subjectName: "Основи програмування",
          roomName: "КН-21",
          dayOfWeek: 1,
          periodNumber: 1,
          weekType: "numerator",
        },
      ],
    });
  });

  it("читає CSV з українськими заголовками та лапками", () => {
    const result = parseScheduleImport({
      fileName: "schedule.csv",
      content: [
        "предмет,аудиторія,день,пара,тиждень",
        '"Проєктування, систем",А-101,середа,3,"обидва тижні"',
      ].join("\n"),
    });

    expect(result).toMatchObject({
      ok: true,
      rows: [
        {
          subjectName: "Проєктування, систем",
          roomName: "А-101",
          dayOfWeek: 3,
          periodNumber: 3,
          weekType: "both",
        },
      ],
    });
  });

  it("дозволяє різні заняття у чисельнику та знаменнику одного слота", () => {
    const result = parseScheduleImport({
      fileName: "schedule.json",
      content: JSON.stringify([
        { subject: "Математика", room: "101", day: 1, period: 2, weekType: "numerator" },
        { subject: "Фізика", room: "102", day: 1, period: 2, weekType: "denominator" },
      ]),
    });

    expect(result.ok).toBe(true);
  });

  it("відхиляє конфлікт викладача всередині файлу", () => {
    const result = parseScheduleImport({
      fileName: "schedule.json",
      content: JSON.stringify([
        { subject: "Математика", room: "101", day: "понеділок", period: 2, weekType: "numerator" },
        { subject: "Фізика", room: "102", day: "понеділок", period: 2, weekType: "both" },
      ]),
    });

    expect(result).toEqual({
      ok: false,
      errors: [
        "Рядок 2: заняття конфліктує з рядком 1 за днем, парою та типом тижня.",
      ],
    });
  });

  it.each(["json", "csv"])("приклад %s готовий до імпорту", (extension) => {
    const fileName = `schedule-import-example.${extension}`;
    const result = parseScheduleImport({
      fileName,
      content: readFileSync(`public/examples/${fileName}`, "utf8"),
    });

    expect(result.ok).toBe(true);
  });
});
