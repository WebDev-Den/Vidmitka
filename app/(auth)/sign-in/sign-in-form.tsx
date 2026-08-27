"use client";

import { LogIn } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";

import { signInAction } from "../actions";
import { initialAuthActionState } from "../form-state";

export function SignInForm() {
  const [state, formAction, pending] = useActionState(
    signInAction,
    initialAuthActionState,
  );

  return (
    <div className="auth-card">
      <div className="auth-card-heading">
        <span className="eyebrow">ВХІД ДО СИСТЕМИ</span>
        <h2>Увійти</h2>
        <p>Використайте електронну адресу та пароль свого облікового запису.</p>
      </div>

      <form action={formAction} className="auth-form">
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
            autoComplete="current-password"
            aria-invalid={Boolean(state.fieldErrors.password)}
            required
          />
          {state.fieldErrors.password ? (
            <small className="auth-field-error">{state.fieldErrors.password}</small>
          ) : null}
        </label>

        {state.message ? (
          <p className="auth-message is-error" role="alert">
            {state.message}
          </p>
        ) : null}

        <button className="button button-primary auth-submit" type="submit" disabled={pending}>
          <LogIn size={17} />
          {pending ? "Вхід…" : "Увійти"}
        </button>
      </form>

      <p className="auth-switch">
        Ще немає облікового запису? <Link href="/sign-up">Зареєструватися</Link>
      </p>
    </div>
  );
}
