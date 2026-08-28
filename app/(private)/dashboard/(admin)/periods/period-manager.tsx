"use client";

import { Check, Clock3, PauseCircle, Plus, Save } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { PERIOD_COLORS, parsePeriodColor, type PeriodColor } from "@/lib/class-periods/colors";

import {
  createClassPeriodAction,
  updateClassPeriodAction,
} from "./actions";
import { initialPeriodActionState } from "./form-state";

type PeriodView = Readonly<{
  id: string;
  number: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
  color: PeriodColor;
}>;

function PeriodColorField({ color = "#0F766E", label = "Колір шкали" }: {
  color?: PeriodColor;
  label?: string;
}) {
  const [selected, setSelected] = useState(color);

  return (
    <label>
      <span>Колір шкали</span>
      <span className="period-color-control">
        <span className="period-color-swatch" style={{ backgroundColor: selected }} aria-hidden="true" />
        <select name="color" value={selected} aria-label={label} required
          onChange={(event) => {
            const value = parsePeriodColor(event.target.value);
            if (value) setSelected(value);
          }}>
          {PERIOD_COLORS.map((option) => (
            <option key={option.value} value={option.value}>{option.name}</option>
          ))}
        </select>
      </span>
    </label>
  );
}

function ActionMessage({
  state,
}: {
  state: typeof initialPeriodActionState;
}) {
  if (!state.message) return null;

  return (
    <p
      className={`period-action-message${state.success ? " is-success" : " is-error"}`}
      role={state.success ? "status" : "alert"}
    >
      {state.success ? <Check size={15} /> : null}
      {state.message}
    </p>
  );
}

function SubmitButton({
  children,
  className,
  name,
  value,
}: {
  children: React.ReactNode;
  className: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      className={className}
      type="submit"
      name={name}
      value={value}
      disabled={pending}
    >
      {children}
      <span className="sr-only">{pending ? "Виконується" : ""}</span>
    </button>
  );
}

function CreatePeriodForm() {
  const [state, formAction] = useActionState(
    createClassPeriodAction,
    initialPeriodActionState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success, state.submittedAt]);

  return (
    <form ref={formRef} action={formAction} className="period-create-form">
      <div className="period-create-heading">
        <span className="period-icon"><Plus size={20} /></span>
        <div>
          <h2>Додати пару</h2>
          <p>Вкажіть номер, час і колір пари на публічній шкалі.</p>
        </div>
      </div>

      <div className="period-fields">
        <label>
          Номер пари
          <input name="number" type="number" min="1" max="99" required />
        </label>
        <label>
          Початок
          <input name="startTime" type="time" required />
        </label>
        <label>
          Завершення
          <input name="endTime" type="time" required />
        </label>
        <PeriodColorField key={state.success ? state.submittedAt : "new"} />
        <SubmitButton className="button button-primary period-create-button">
          <Plus size={17} />
          Додати пару
        </SubmitButton>
      </div>
      <ActionMessage state={state} />
    </form>
  );
}

function PeriodRow({ period }: { period: PeriodView }) {
  const updateAction = updateClassPeriodAction.bind(null, period.id);
  const [state, formAction] = useActionState(
    updateAction,
    initialPeriodActionState,
  );

  return (
    <form action={formAction} className="period-row">
      <label className="period-number-field">
        <span>Номер пари</span>
        <span className="period-number-input">
          <input
            name="number"
            type="number"
            min="1"
            max="99"
            defaultValue={period.number}
            required
            aria-label={`Номер ${period.number} пари`}
          />
          <small>пара</small>
        </span>
      </label>
      <label>
        <span>Початок</span>
        <input
          name="startTime"
          type="time"
          defaultValue={period.startTime}
          required
          aria-label={`Час початку ${period.number} пари`}
        />
      </label>
      <label>
        <span>Завершення</span>
        <input
          name="endTime"
          type="time"
          defaultValue={period.endTime}
          required
          aria-label={`Час завершення ${period.number} пари`}
        />
      </label>
      <PeriodColorField key={period.color} color={period.color} label={`Колір ${period.number} пари`} />
      <div className="period-status-cell">
        <span className={`period-status${period.isActive ? " is-active" : " is-inactive"}`}>
          {period.isActive ? "Активна" : "Неактивна"}
        </span>
      </div>
      <div className="period-row-actions">
        <SubmitButton className="button button-light" name="intent" value="save">
          <Save size={16} />
          Зберегти
        </SubmitButton>
        <SubmitButton
          className="button button-ghost-light"
          name="intent"
          value={period.isActive ? "deactivate" : "activate"}
        >
          {period.isActive ? <PauseCircle size={16} /> : <Check size={16} />}
          {period.isActive ? "Деактивувати" : "Активувати"}
        </SubmitButton>
      </div>
      <ActionMessage state={state} />
    </form>
  );
}

export function PeriodManager({ periods }: { periods: PeriodView[] }) {
  const activeCount = periods.filter((period) => period.isActive).length;

  return (
    <div className="period-manager">
      <div className="period-summary">
        <Clock3 size={22} />
        <div>
          <strong>{activeCount} активних пар</strong>
          <span>Кольори позначають пари на публічній шкалі часу. Неактивні пари на ній не показуються.</span>
        </div>
      </div>

      <CreatePeriodForm />

      <section className="period-list-section" aria-labelledby="period-list-title">
        <div className="period-list-heading">
          <div>
            <span className="eyebrow">ПОТОЧНИЙ ПЕРЕЛІК</span>
            <h2 id="period-list-title">Навчальні пари</h2>
          </div>
          <span>{periods.length} записів</span>
        </div>
        <div className="period-list">
          {periods.map((period) => (
            <PeriodRow key={period.id} period={period} />
          ))}
        </div>
      </section>
    </div>
  );
}
