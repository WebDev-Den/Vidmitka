"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { ManagementFeedback, ManagementStatus, ManagementTable } from "@/components/private/management-table";
import type { PeriodColor } from "@/lib/class-periods/colors";
import { createClassPeriodAction, updateClassPeriodAction } from "./actions";
import { initialPeriodActionState } from "./form-state";
import { PeriodColorField } from "./period-color-field";

type PeriodView = Readonly<{
  id: string; number: number; startTime: string; endTime: string; isActive: boolean; color: PeriodColor;
}>;

function PeriodFields({ formId, period, pending, colorKey }: {
  formId: string; period?: PeriodView; pending: boolean; colorKey?: string | number;
}) {
  const suffix = period ? " " + period.number + " пари" : " нової пари";
  return <>
    <td className="management-number-cell"><input form={formId} name="number" type="number" min="1" max="99"
      defaultValue={period?.number} aria-label={"Номер" + suffix} required disabled={pending} /></td>
    <td><input form={formId} name="startTime" type="time" defaultValue={period?.startTime}
      aria-label={"Час початку" + suffix} required disabled={pending} /></td>
    <td><input form={formId} name="endTime" type="time" defaultValue={period?.endTime}
      aria-label={"Час завершення" + suffix} required disabled={pending} /></td>
    <td><PeriodColorField key={colorKey ?? period?.color} form={formId} color={period?.color}
      label={"Колір" + suffix} disabled={pending} hideLabel /></td>
  </>;
}

function CreatePeriodRow() {
  const formId = useId();
  const [state, action, pending] = useActionState(createClassPeriodAction, initialPeriodActionState);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success, state.submittedAt]);

  return <tbody>
    <tr className="management-new-row">
      <PeriodFields formId={formId} pending={pending} colorKey={state.success ? state.submittedAt : "new"} />
      <td><span className="management-muted">Нова пара</span></td>
      <td className="management-actions-cell"><form id={formId} ref={formRef} action={action}>
        <button className="button button-primary" disabled={pending}>{pending ? "Додавання…" : "Додати пару"}</button>
      </form></td>
    </tr>
    <ManagementFeedback state={state} colSpan={6} />
  </tbody>;
}

function PeriodRow({ period }: { period: PeriodView }) {
  const formId = useId();
  const [state, action, pending] = useActionState(updateClassPeriodAction.bind(null, period.id), initialPeriodActionState);
  return <tbody>
    <tr>
      <PeriodFields formId={formId} period={period} pending={pending} />
      <td><ManagementStatus active={period.isActive} feminine /></td>
      <td className="management-actions-cell"><form id={formId} action={action} className="management-actions">
        <button className="button button-light" name="intent" value="save" disabled={pending}
          aria-label={"Зберегти пару " + period.number}>{pending ? "Виконується…" : "Зберегти"}</button>
        <button className="button button-light" name="intent" value={period.isActive ? "deactivate" : "activate"}
          disabled={pending} aria-label={(period.isActive ? "Деактивувати пару " : "Активувати пару ") + period.number}>
          {period.isActive ? "Деактивувати" : "Активувати"}
        </button>
      </form></td>
    </tr>
    <ManagementFeedback state={state} colSpan={6} />
  </tbody>;
}

export function PeriodManager({ periods }: { periods: PeriodView[] }) {
  return <div className="management-stack">
    <p className="management-description">{periods.filter((period) => period.isActive).length} активних пар · Кольори позначають пари на публічній шкалі. Неактивні пари не показуються.</p>
    <ManagementTable caption="Навчальні пари" columns={["№ пари", "Початок", "Завершення", "Колір", "Стан", "Дії"]} minWidth={870}>
      <CreatePeriodRow />
      {periods.map((period) => <PeriodRow key={period.id} period={period} />)}
      {!periods.length && <tbody><tr><td colSpan={6} className="management-muted">Пар ще немає. Додайте першу пару.</td></tr></tbody>}
    </ManagementTable>
  </div>;
}
