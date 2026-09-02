import { describe, expect, it } from "vitest";

import { validateLoginForm } from "./validation";

describe("validateLoginForm", () => {
  it("нормалізує адресу адміністратора", () => {
    const form = new FormData();
    form.set("email", " Admin@Example.EDU ");
    form.set("password", "Secret1!");
    expect(validateLoginForm(form)).toMatchObject({ ok: true, value: { email: "admin@example.edu" } });
  });

  it("не приймає порожній пароль або некоректну адресу", () => {
    const form = new FormData();
    form.set("email", "bad");
    form.set("password", "");
    expect(validateLoginForm(form)).toMatchObject({
      ok: false,
      fieldErrors: { email: expect.any(String), password: expect.any(String) },
    });
  });
});
