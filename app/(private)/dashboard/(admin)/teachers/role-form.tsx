"use client";

import { useActionState } from "react";
import type { AppRole } from "@/lib/auth/roles";
import { changeRoleAction } from "./actions";

export function AccountRoleForm({ userId, role }: { userId: string; role: AppRole }) {
  const [state, action, pending] = useActionState(changeRoleAction, { success: false, message: "" });
  const nextRole = role === "administrator" ? "teacher" : "administrator";
  return <form action={action}>
    <input type="hidden" name="userId" value={userId} />
    <input type="hidden" name="role" value={nextRole} />
    <button className="button button-light" type="submit" disabled={pending}>
      {pending ? "Збереження…" : nextRole === "administrator" ? "Призначити адміністратором" : "Залишити лише викладачем"}
    </button>
    {state.message ? <p className={`period-action-message ${state.success ? "is-success" : "is-error"}`}
      role={state.success ? "status" : "alert"}>{state.message}</p> : null}
  </form>;
}
