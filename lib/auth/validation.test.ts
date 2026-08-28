import { describe, expect, it } from "vitest";

import { validateLoginForm, validateRegistrationForm } from "./validation";

function registrationForm(password: string, confirmation = password): FormData {
  const form = new FormData();
  form.set("fullName", "Тестенко Марія Іванівна");
  form.set("email", "registration@example.test");
  form.set("password", password);
  form.set("passwordConfirmation", confirmation);
  return form;
}

describe("перевірка форми реєстрації", () => {
  it("приймає пароль із 6 символів із великою літерою, цифрою та спецсимволом", () => {
    expect(validateRegistrationForm(registrationForm("Abc1!?"))).toMatchObject({
      ok: true,
      value: { password: "Abc1!?" },
    });
  });

  it("відхиляє пароль без великої літери", () => {
    expect(validateRegistrationForm(registrationForm("abcdef123!"))).toMatchObject({
      ok: false,
      fieldErrors: { password: "Додайте до пароля щонайменше одну велику літеру." },
    });
  });

  it("відхиляє пароль без цифри", () => {
    expect(validateRegistrationForm(registrationForm("Abcdef!?"))).toMatchObject({
      ok: false,
      fieldErrors: { password: "Додайте до пароля щонайменше одну цифру." },
    });
  });

  it("відхиляє пароль без спецсимволу, навіть якщо він містить пробіл", () => {
    expect(validateRegistrationForm(registrationForm("Abcdef 123"))).toMatchObject({
      ok: false,
      fieldErrors: { password: "Додайте до пароля щонайменше один спецсимвол, наприклад !, @ або #." },
    });
  });

  it.each(["Ab1!?", `Ab1!${"x".repeat(125)}`])("відхиляє пароль поза дозволеною довжиною", (password) => {
    expect(validateRegistrationForm(registrationForm(password))).toMatchObject({
      ok: false,
      fieldErrors: { password: "Пароль має містити від 6 до 128 символів." },
    });
  });

  it.each(["Їжак1!", `Ab1!${"x".repeat(124)}`])("приймає українську велику літеру та граничну довжину", (password) => {
    expect(validateRegistrationForm(registrationForm(password)).ok).toBe(true);
  });

  it.each(["", "Abc1!X", "Abc1!? "])("відхиляє порожнє або відмінне підтвердження", (confirmation) => {
    expect(validateRegistrationForm(registrationForm("Abc1!?", confirmation))).toMatchObject({
      ok: false,
      fieldErrors: { passwordConfirmation: "Паролі не збігаються." },
    });
  });

  it("не сприймає відсутнє підтвердження як збіг", () => {
    const form = registrationForm("Abc1!?");
    form.delete("passwordConfirmation");
    expect(validateRegistrationForm(form)).toMatchObject({
      ok: false,
      fieldErrors: { passwordConfirmation: "Паролі не збігаються." },
    });
  });

  it("не змінює введений пароль і не віддає його у відповіді з помилкою", () => {
    expect(validateRegistrationForm(registrationForm(" Abc1!? "))).toMatchObject({
      ok: true,
      value: { password: " Abc1!? " },
    });
    const result = validateRegistrationForm(registrationForm("Abc1!?", "wrong"));
    expect(JSON.stringify(result)).not.toContain("Abc1!?");
    expect(JSON.stringify(result)).not.toContain("wrong");
  });
});

describe("сумісність форми входу", () => {
  it("не застосовує нові правила реєстрації до чинних паролів", () => {
    expect(validateLoginForm(registrationForm("old password without digits"))).toEqual({
      ok: true,
      value: { email: "registration@example.test", password: "old password without digits" },
    });
  });
});
