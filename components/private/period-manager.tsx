"use client";

import { Save } from "lucide-react";
import { useActionState, useEffect, useId, useRef, useState, type ChangeEvent } from "react";

import { ColorField } from "@/components/color-field";
import { ManagementFeedback, ManagementStatus, ManagementTable } from "@/components/private/management-table";
import { createClassPeriodAction, updateClassPeriodAction, updateClassPeriodsAction } from "@/app/admin/(protected)/periods/actions";
import { initialPeriodActionState } from "@/app/admin/(protected)/periods/form-state";
import type { ClassPeriod } from "@/lib/class-periods/repository";
import type { PeriodColor } from "@/lib/class-periods/colors";

type PeriodDraft = Readonly<{ number: string; startTime: string; endTime: string; color: PeriodColor }>;

function draftFor(period: ClassPeriod): PeriodDraft {
  return { number: String(period.number), startTime: period.startTime, endTime: period.endTime, color: period.color };
}

function Fields({ formId, period, pending, draft, onChange }: {
  formId?: string;
  period?: ClassPeriod;
  pending: boolean;
  draft?: PeriodDraft;
  onChange?: (patch: Partial<PeriodDraft>) => void;
}) {
  const suffix = period ? ` ${period.number} пари` : " нової пари";
  return <>
    <td className="management-number-cell"><input form={formId} name="number" type="number" min="1" max="99"
      {...(draft ? { value: draft.number, onChange: (event: ChangeEvent<HTMLInputElement>) => onChange?.({ number: event.currentTarget.value }) } : { defaultValue: period?.number })}
      aria-label={`Номер${suffix}`} required disabled={pending} /></td>
    <td><input form={formId} name="startTime" type="time"
      {...(draft ? { value: draft.startTime, onChange: (event: ChangeEvent<HTMLInputElement>) => onChange?.({ startTime: event.currentTarget.value }) } : { defaultValue: period?.startTime })}
      aria-label={`Початок${suffix}`} required disabled={pending} /></td>
    <td><input form={formId} name="endTime" type="time"
      {...(draft ? { value: draft.endTime, onChange: (event: ChangeEvent<HTMLInputElement>) => onChange?.({ endTime: event.currentTarget.value }) } : { defaultValue: period?.endTime })}
      aria-label={`Завершення${suffix}`} required disabled={pending} /></td>
    <td><ColorField form={formId} color={draft?.color ?? period?.color} label={`Колір${suffix}`} hideLabel disabled={pending}
      onValueChange={(color) => onChange?.({ color })} /></td>
  </>;
}

function CreateRow({ disabled }: { disabled: boolean }) {
  const formId = useId();
  const [state, action, pending] = useActionState(createClassPeriodAction, initialPeriodActionState);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.success) ref.current?.reset(); }, [state.success, state.submittedAt]);
  return <tbody><tr className="management-new-row"><Fields formId={formId} pending={pending || disabled} /><td>Нова пара</td><td><form id={formId} ref={ref} action={action}>
    <button className="button button-primary" disabled={pending || disabled}>{pending ? "Додавання…" : "Додати пару"}</button>
  </form></td></tr><ManagementFeedback state={state} colSpan={6} /></tbody>;
}

function Row({ period, draft, onChange, batchPending, hasChanges }: {
  period: ClassPeriod;
  draft: PeriodDraft;
  onChange: (patch: Partial<PeriodDraft>) => void;
  batchPending: boolean;
  hasChanges: boolean;
}) {
  const [state, action, pending] = useActionState(updateClassPeriodAction.bind(null, period.id), initialPeriodActionState);
  const actionDisabled = pending || batchPending || hasChanges;
  return <tbody><tr><Fields period={period} draft={draft} onChange={onChange} pending={pending || batchPending} />
    <td><ManagementStatus active={period.isActive} feminine /></td><td><form action={action} className="management-actions">
      <button className="button button-light" name="intent" value={period.isActive ? "deactivate" : "activate"}
        disabled={actionDisabled} title={hasChanges ? "Спершу збережіть або поверніть зміни." : undefined}>
        {period.isActive ? "Деактивувати" : "Активувати"}
      </button>
    </form></td>
  </tr><ManagementFeedback state={state} colSpan={6} /></tbody>;
}

export function PeriodManager({ periods }: { periods: ClassPeriod[] }) {
  const [state, batchAction, pending] = useActionState(updateClassPeriodsAction, initialPeriodActionState);
  const [drafts, setDrafts] = useState<Record<string, PeriodDraft>>({});
  const batchFormId = useId();
  const changedPeriods = periods.filter((period) => drafts[period.id] !== undefined);
  const hasChanges = changedPeriods.length > 0;
  const encodedChanges = JSON.stringify(changedPeriods.map((period) => ({ id: period.id, ...drafts[period.id]! })));

  useEffect(() => setDrafts({}), [periods]);

  const updateDraft = (period: ClassPeriod, patch: Partial<PeriodDraft>) => {
    setDrafts((previous) => {
      const next = { ...(previous[period.id] ?? draftFor(period)), ...patch };
      const original = draftFor(period);
      const unchanged = next.number === original.number && next.startTime === original.startTime
        && next.endTime === original.endTime && next.color === original.color;
      if (unchanged) {
        const { [period.id]: _discarded, ...rest } = previous;
        return rest;
      }
      return { ...previous, [period.id]: next };
    });
  };

  return <div className="management-stack"><p className="management-description">{periods.filter((item) => item.isActive).length} активних пар.</p>
    {hasChanges ? <div className="management-actions" role="status" aria-live="polite">
      <span className="management-muted">Змінено пар: {changedPeriods.length}</span>
      <button form={batchFormId} className="button button-primary" disabled={pending}>
        <Save size={16} aria-hidden="true" /> {pending ? "Збереження…" : `Зберегти зміни (${changedPeriods.length})`}
      </button>
    </div> : null}
    {state.message ? <p className={`period-action-message ${state.success ? "is-success" : "is-error"}`}
      role={state.success ? "status" : "alert"}>{state.message}</p> : null}
    <ManagementTable caption="Навчальні пари" columns={["№ пари", "Початок", "Завершення", "Колір", "Стан", "Дії"]} minWidth={870}>
      <CreateRow disabled={pending || hasChanges} />
      {periods.map((period) => <Row key={period.id} period={period} draft={drafts[period.id] ?? draftFor(period)}
        onChange={(patch) => updateDraft(period, patch)} batchPending={pending} hasChanges={hasChanges} />)}
    </ManagementTable>
    <form id={batchFormId} action={batchAction}>
      <input type="hidden" name="changes" value={encodedChanges} />
    </form>
  </div>;
}
