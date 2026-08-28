import { describe, expect, it } from "vitest";
import { validateLessonTypeName } from "./rules";

describe("назва типу заняття", () => {
  it("дозволяє власну назву адміністратора й нормалізує пробіли", () => {
    expect(validateLessonTypeName("  Індивідуальна   консультація  ")).toEqual({ ok: true, name: "Індивідуальна консультація" });
  });
  it.each([null, "", " ", "Л", "а".repeat(101), "Лекція\u0000", 42])("відхиляє некоректну назву %#", (name) => {
    expect(validateLessonTypeName(name).ok).toBe(false);
  });
});
