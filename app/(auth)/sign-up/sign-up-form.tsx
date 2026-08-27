"use client";

import { UserPlus } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";

import { signUpAction } from "../actions";
import { initialAuthActionState } from "../form-state";

export function SignUpForm() {
  const [state, formAction, pending] = useActionState(
    signUpAction,
    initialAuthActionState,
  );

  return (
    <div className="auth-card">
      <div className="auth-card-heading">
        <span className="eyebrow">РЕЄСТРАЦІЯ</span>
        <h2>Створити обліковий запис</h2>
        <p>Новий викладач отримує доступ після підтвердження адміністратором.</p>
      </div>

      <form action={formAction} className="auth-form">
        <label>
          ПІБ
          <input
            name="fullName"
            type="text"
            autoComplete="name"
            minLength={3}
            maxLength={200}
            defaultValue={state.values.fullName}
            aria-invalid={Boolean(state.fieldErrors.fullName)}
            required
          />
          {state.fieldErrors.fullName ? (
            <small className="auth-field-error">{state.fieldErrors.fullName}</small>
          ) : null}
        </label>

        <label>
          Електронна адреса
          <input
            name="email"
            type="email"
            autoComplete="email"
            defaultValue={state.values.email}
            aria-invalid={Boolean(state.fieldErrors.email)}
            required
          />
          {state.fieldErrors.email ? (
            <small className="auth-field-error">{state.fieldErrors.email}</small>
          ) : null}
        </label>

        <label>
          Пароль
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={15}
            maxLength={128}
            aria-invalid={Boolean(state.fieldErrors.password)}
            required
          />
          {state.fieldErrors.password ? (
            <small className="auth-field-error">{state.fieldErrors.password}</small>
          ) : (
            <small className="auth-field-hint">Від 15 символів. Можна використати довгу фразу.</small>
          )}
        </label>

        <label>
          Повторіть пароль
          <input
            name="passwordConfirmation"
            type="password"
            autoComplete="new-password"
            aria-invalid={Boolean(state.fieldErrors.passwordConfirmation)}
            required
          />
          {state.fieldErrors.passwordConfirmation ? (
            <small className="auth-field-error">
              {state.fieldErrors.passwordConfirmation}
            </small>
          ) : null}
        </label>

        <label>
          Код адміністратора
          <input
            name="administratorCode"
            type="password"
            autoComplete="off"
          />
          <small className="auth-field-hint">
            Заповнює лише адміністратор. Викладач залишає це поле порожнім.
          </small>
        </label>

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
