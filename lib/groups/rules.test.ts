import { describe, expect, it } from "vitest";
import { validateGroupSelection } from "./rules";

describe("вибір групи", () => {
  it("бере вибрану наявну групу та ігнорує назву нової", () => {
    expect(validateGroupSelection({ mode: "existing", existingName: "КН-21", newName: "ПІ-22" })).toEqual({ ok: true, name: "КН-21", mustExist: true });
  });
  it("нормалізує назву нової групи", () => {
    expect(validateGroupSelection({ mode: "new", existingName: "КН-21", newName: "  КН   31  " })).toEqual({ ok: true, name: "КН 31", mustExist: false });
  });
  it.each([
    { mode: "bad", existingName: "КН-21", newName: "КН-21" },
    { mode: "existing", existingName: "", newName: "КН-21" },
    { mode: "new", existingName: "КН-21", newName: "А" },
    { mode: "new", existingName: "", newName: "А".repeat(101) },
  ])("відхиляє некоректний вибір %#", (input) => expect(validateGroupSelection(input).ok).toBe(false));
});
