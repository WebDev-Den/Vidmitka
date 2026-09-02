"use client";

import { LogIn } from "lucide-react";
import { useActionState } from "react";

import { adminSignInAction } from "./actions";
import { initialAdminAuthActionState } from "./form-state";

export function AdminLoginForm() {
  const [state, formAction, pending] = useActionState(adminSignInAction, initialAdminAuthActionState);

  return <div className="auth-card">
    <div className="auth-card-heading">
      <span className="eyebrow">АДМІНІСТРУВАННЯ</span>
      <h2>Вхід адміністратора</h2>
      <p>Уведіть облікові дані адміністратора системи розкладу.</p>
    </div>
    <form action={formAction} className="auth-form">
      <label>Електронна адреса
        <input name="email" type="email" autoComplete="username"
          defaultValue={state.values.email} aria-invalid={Boolean(state.fieldErrors.email)} required />
        {state.fieldErrors.email ? <small className="auth-field-error">{state.fieldErrors.email}</small> : null}
      </label>
      <label>Пароль
        <input name="password" type="password" autoComplete="current-password"
          aria-invalid={Boolean(state.fieldErrors.password)} required />
        {state.fieldErrors.password ? <small className="auth-field-error">{state.fieldErrors.password}</small> : null}
      </label>
      {state.message ? <p className="auth-message is-error" role="alert">{state.message}</p> : null}
      <button className="button button-primary auth-submit" type="submit" disabled={pending}>
        <LogIn size={17} /> {pending ? "Вхід…" : "Увійти"}
      </button>
    </form>
  </div>;
}
