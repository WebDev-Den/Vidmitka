"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { ManagementFeedback, ManagementStatus, ManagementTable } from "./management-table";
import { ManagementSubmit } from "./management-submit";

type ActionState = Readonly<{ success: boolean; message: string }>;
type DirectoryEntry = Readonly<{ id: string; name: string; isActive: boolean }>;

export function DirectoryManager({ entries, createAction, toggleAction, caption, fieldLabel, addLabel, emptyMessage, maxLength, feminine = false }: {
  entries: readonly DirectoryEntry[];
  createAction: (previous: ActionState, data: FormData) => Promise<ActionState>;
  toggleAction: (id: string, active: boolean) => Promise<void>;
  caption: string;
  fieldLabel: string;
  addLabel: string;
  emptyMessage: string;
  maxLength: number;
  feminine?: boolean;
}) {
  const [state, action, pending] = useActionState(createAction, { success: false, message: "" });
  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success, state.message]);

  return <ManagementTable caption={caption} columns={[fieldLabel, "Стан", "Дії"]}>
    <tbody>
      <tr className="management-new-row">
        <td><input form={formId} name="name" type="text" maxLength={maxLength} required
          aria-label={fieldLabel} placeholder={fieldLabel} disabled={pending} /></td>
        <td><span className="management-muted">Новий запис</span></td>
        <td className="management-actions-cell"><form id={formId} ref={formRef} action={action}>
          <button className="button button-primary" disabled={pending}>{pending ? "Додавання…" : addLabel}</button>
        </form></td>
      </tr>
      <ManagementFeedback state={state} colSpan={3} />
    </tbody>
    <tbody>
      {entries.map((entry) => <tr key={entry.id}>
        <th scope="row">{entry.name}</th>
        <td><ManagementStatus active={entry.isActive} feminine={feminine} /></td>
        <td className="management-actions-cell"><form action={toggleAction.bind(null, entry.id, !entry.isActive)}>
          <ManagementSubmit className="button button-light" aria-label={`${entry.isActive ? "Деактивувати" : "Активувати"}: ${entry.name}`}>
            {entry.isActive ? "Деактивувати" : "Активувати"}
          </ManagementSubmit>
        </form></td>
      </tr>)}
      {!entries.length && <tr><td colSpan={3} className="management-muted">{emptyMessage}</td></tr>}
    </tbody>
  </ManagementTable>;
}
