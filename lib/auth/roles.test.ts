import { describe, expect, it } from "vitest";

import {
  parseAdminEmails,
  resolveAccountAccess,
  resolveRole,
} from "./roles";

describe("parseAdminEmails", () => {
  it("нормалізує регістр, пробіли та підтримує кілька роздільників", () => {
    expect(
      parseAdminEmails(
        " Admin@University.edu,owner@example.com; second@example.com\nthird@example.com ",
      ),
    ).toEqual(
      new Set([
        "admin@university.edu",
        "owner@example.com",
        "second@example.com",
        "third@example.com",
      ]),
    );
  });

  it("ігнорує порожні значення", () => {
    expect(parseAdminEmails(" , ; \n ")).toEqual(new Set());
  });
});

describe("resolveRole", () => {
  it("повертає administrator для точного email зі списку", () => {
    expect(resolveRole("ADMIN@university.edu", "admin@university.edu")).toBe(
      "administrator",
    );
  });

  it("не надає права за частковим збігом email", () => {
    expect(
      resolveRole("not-admin@university.edu", "admin@university.edu"),
    ).toBe("teacher");
  });

  it("використовує роль teacher як безпечне значення за замовчуванням", () => {
    expect(resolveRole(null, "admin@university.edu")).toBe("teacher");
    expect(resolveRole("teacher@university.edu", "")).toBe("teacher");
  });
});

describe("resolveAccountAccess", () => {
  it("автоматично схвалює адміністратора зі списку email", () => {
    expect(
      resolveAccountAccess(
        "admin@university.edu",
        false,
        "admin@university.edu",
      ),
    ).toEqual({ role: "administrator", approval: "approved" });
  });

  it("залишає нового викладача в очікуванні підтвердження", () => {
    expect(
      resolveAccountAccess(
        "teacher@khmnu.edu.ua",
        undefined,
        "admin@university.edu",
      ),
    ).toEqual({ role: "teacher", approval: "pending" });
  });

  it("відкриває доступ викладачу лише після явного схвалення", () => {
    expect(
      resolveAccountAccess(
        "teacher@khmnu.edu.ua",
        true,
        "admin@university.edu",
      ),
    ).toEqual({ role: "teacher", approval: "approved" });
  });
});
