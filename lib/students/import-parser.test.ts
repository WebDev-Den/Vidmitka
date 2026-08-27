import { describe, expect, it } from "vitest";
import { parseStudentImport } from "./import-parser";

const student = { fullName: "  Анна   Ковальчук ", groupName: " КН-21 ", subgroup: "1" };
describe("імпорт студентів", () => {
  it("нормалізує JSON і зберігає необов’язкову підгрупу", () => {
    expect(parseStudentImport("students.JSON", `\uFEFF${JSON.stringify([student])}`)).toEqual({
      ok: true, rows: [{ fullName: "Анна Ковальчук", groupName: "КН-21", subgroup: "1" }],
    });
  });
  it.each([",", ";"])("читає CSV %s, BOM, CRLF і екрановані лапки", (delimiter) => {
    expect(parseStudentImport("students.csv", `\uFEFFПІБ${delimiter}Група${delimiter}Підгрупа\r\n"Анна ""Марія"" Ковальчук"${delimiter}КН-21${delimiter}2\r\n`)).toEqual({
      ok: true, rows: [{ fullName: 'Анна "Марія" Ковальчук', groupName: "КН-21", subgroup: "2" }],
    });
  });
  it("відрізняє відсутню підгрупу від її очищення", () => {
    expect(parseStudentImport("a.csv", "fullName,groupName\nАнна Ковальчук,КН-21")).toEqual({
      ok: true, rows: [{ fullName: "Анна Ковальчук", groupName: "КН-21", subgroup: null }],
    });
  });
  it.each([
    ["a.json", "[]"], ["a.json", "{}"], ["a.json", "[null]"], ["a.json", "["],
    ["a.csv", "fullName,groupName\n\"Анна,КН-21"],
    ["a.csv", "fullName,groupName\nАнна,КН-21,зайве"],
    ["a.csv", "fullName,fullName,groupName\nАнна,Марія,КН-21"],
    ["a.json", JSON.stringify([{ ...student, fullName: "А" }])],
    ["a.json", JSON.stringify([{ ...student, subgroup: 1 }])],
    ["a.json", JSON.stringify([student, student])],
    ["a.txt", JSON.stringify([student])],
  ])("відхиляє неправильний файл %# без часткового імпорту", (name, content) => {
    expect(parseStudentImport(name, content).ok).toBe(false);
  });
  it("обмежує кількість рядків", () => {
    expect(parseStudentImport("a.json", JSON.stringify(Array.from({ length: 501 }, (_, i) => ({ ...student, fullName: `Студент ${i}` })))).ok).toBe(false);
  });
});
