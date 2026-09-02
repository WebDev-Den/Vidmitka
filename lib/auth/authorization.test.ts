import { describe, expect, it } from "vitest";

import { isApprovedAdministrator } from "./authorization";

describe("isApprovedAdministrator", () => {
  it("дозволяє лише схваленого адміністратора", () => {
    expect(isApprovedAdministrator({ role: "administrator", approval: "approved" })).toBe(true);
    expect(isApprovedAdministrator({ role: "administrator", approval: "pending" })).toBe(false);
    expect(isApprovedAdministrator({ role: "teacher", approval: "approved" })).toBe(false);
    expect(isApprovedAdministrator(null)).toBe(false);
  });
});
