import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import * as rooms from "@/app/(private)/dashboard/(admin)/rooms/actions";
import * as subjects from "@/app/(private)/dashboard/(admin)/subjects/actions";
import * as periods from "@/app/(private)/dashboard/(admin)/periods/actions";
import * as scheduleImport from "@/app/(private)/dashboard/import-schedule/actions";
import * as makeupDays from "@/app/(private)/dashboard/(admin)/settings/makeup-actions";
import * as lessonTypes from "@/app/(private)/dashboard/(admin)/lesson-types/actions";
import * as lessonTypeAssignment from "@/app/(private)/dashboard/my-lessons/actions";
import * as lessonDirectories from "@/app/(private)/dashboard/lessons/new/directory-actions";
import * as lessonRoster from "@/app/(private)/dashboard/my-lessons/[lessonId]/students/actions";

describe("контракт серверних дій Next.js", () => {
  it.each([
    ["аудиторії", rooms],
    ["предмети", subjects],
    ["навчальні пари", periods],
    ["імпорт розкладу", scheduleImport],
    ["календар відпрацювань", makeupDays],
    ["типи занять", lessonTypes],
    ["призначення типу заняття", lessonTypeAssignment],
    ["швидке додавання довідників", lessonDirectories],
    ["додавання студентів до створеного заняття", lessonRoster],
  ])("%s: модуль експортує тільки асинхронні функції", (_name, actions) => {
    const invalidExports = Object.entries(actions).filter(([, value]) => (
      typeof value !== "function" || value.constructor.name !== "AsyncFunction"
    )).map(([name]) => name);

    expect(invalidExports).toEqual([]);
  });
});
