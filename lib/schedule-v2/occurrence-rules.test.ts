import { describe, expect, it } from "vitest";

import { shouldShowBaseOccurrence } from "./occurrence-rules";

describe("shouldShowBaseOccurrence", () => {
  it("прибирає старий екземпляр перенесеного заняття", () => {
    expect(shouldShowBaseOccurrence({ exceptionKind: "move", selectedDate: "2026-09-01", newDate: "2026-09-03" })).toBe(false);
  });
  it("залишає зміну часу в межах тієї самої дати", () => {
    expect(shouldShowBaseOccurrence({ exceptionKind: "reschedule", selectedDate: "2026-09-01", newDate: "2026-09-01" })).toBe(true);
  });
  it("залишає скасування як видиме повідомлення", () => {
    expect(shouldShowBaseOccurrence({ exceptionKind: "cancel", selectedDate: "2026-09-01", newDate: null })).toBe(true);
  });
});
