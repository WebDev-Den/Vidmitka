"use client";

import { UserPlus } from "lucide-react";
import Link from "next/link";
import { useActionState, useState, type FormEvent } from "react";

import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  validateRegistrationForm,
  type AuthFieldErrors,
} from "@/lib/auth/validation";

import { signUpAction } from "../actions";
import { initialAuthActionState } from "../form-state";

export function SignUpForm({ showAdministratorCode }: { showAdministratorCode: boolean }) {
  const [state, formAction, pending] = useActionState(
    signUpAction,
    initialAuthActionState,
  );
  const [clientErrors, setClientErrors] = useState<AuthFieldErrors | null>(null);
  const fieldErrors = clientErrors ?? state.fieldErrors;

  function validateBeforeSubmit(event: FormEvent<HTMLFormElement>) {
    const validation = validateRegistrationForm(new FormData(event.currentTarget));
    if (!validation.ok) {
      event.preventDefault();
      setClientErrors(validation.fieldErrors);
      const firstInvalidField = event.currentTarget.elements.namedItem(
        Object.keys(validation.fieldErrors)[0],
      );
      if (firstInvalidField instanceof HTMLElement) firstInvalidField.focus();
      return;
    }
    setClientErrors(null);
  }

  return (
    <div className="auth-card">
      <div className="auth-card-heading">
        <span className="eyebrow">РЕЄСТРАЦІЯ</span>
        <h2>Створити обліковий запис</h2>
        <p>Новий викладач отримує доступ після підтвердження адміністратором.</p>
      </div>

      <form
        action={formAction}
        onSubmit={validateBeforeSubmit}
        onInput={() => setClientErrors({})}
        className="auth-form"
      >
        <label>
          ПІБ
          <input
            name="fullName"
            type="text"
            autoComplete="name"
            minLength={3}
            maxLength={200}
            defaultValue={state.values.fullName}
            aria-invalid={Boolean(fieldErrors.fullName)}
            required
          />
          {fieldErrors.fullName ? (
            <small className="auth-field-error">{fieldErrors.fullName}</small>
          ) : null}
        </label>

        <label>
          Електронна адреса
          <input
            name="email"
            type="email"
            autoComplete="email"
            defaultValue={state.values.email}
            aria-invalid={Boolean(fieldErrors.email)}
            required
          />
          {fieldErrors.email ? (
            <small className="auth-field-error">{fieldErrors.email}</small>
          ) : null}
        </label>

        <label htmlFor="registration-password">
          Пароль
          <input
            id="registration-password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={PASSWORD_MIN_LENGTH}
            maxLength={PASSWORD_MAX_LENGTH}
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={fieldErrors.password
              ? "registration-password-hint registration-password-error"
              : "registration-password-hint"}
            required
          />
          <small id="registration-password-hint" className="auth-field-hint">
            Від 6 до 128 символів: щонайменше одна велика літера, цифра та спецсимвол (наприклад !, @ або #).
          </small>
          {fieldErrors.password ? (
            <small id="registration-password-error" className="auth-field-error" role="alert">
              {fieldErrors.password}
            </small>
          ) : null}
        </label>

        <label htmlFor="registration-password-confirmation">
          Повторіть пароль
          <input
            id="registration-password-confirmation"
            name="passwordConfirmation"
            type="password"
            autoComplete="new-password"
            maxLength={PASSWORD_MAX_LENGTH}
            aria-invalid={Boolean(fieldErrors.passwordConfirmation)}
            aria-describedby={fieldErrors.passwordConfirmation
              ? "registration-password-confirmation-error"
              : undefined}
            required
          />
          {fieldErrors.passwordConfirmation ? (
            <small id="registration-password-confirmation-error" className="auth-field-error" role="alert">
              {fieldErrors.passwordConfirmation}
            </small>
          ) : null}
        </label>

        {(state.administratorRegistrationOpen ?? showAdministratorCode) ? <label>
          Код адміністратора
          <input
            name="administratorCode"
            type="password"
            autoComplete="off"
          />
          <small className="auth-field-hint">
            Лише для першої реєстрації адміністратора. Викладач залишає поле порожнім.
          </small>
        </label> : null}

        {state.message ? (
          <p className="auth-message is-error" role="alert">
            {state.message}
          </p>
        ) : null}

        <button className="button button-primary auth-submit" type="submit" disabled={pending}>
          <UserPlus size={17} />
          {pending ? "Створення…" : "Зареєструватися"}
        </button>
      </form>

      <p className="auth-switch">
        Уже маєте обліковий запис? <Link href="/sign-in">Увійти</Link>
      </p>
    </div>
  );
}
