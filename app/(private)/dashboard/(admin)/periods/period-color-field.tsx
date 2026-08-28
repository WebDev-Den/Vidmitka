"use client";

import { Popover } from "@base-ui/react/popover";
import { Check, ChevronDown } from "lucide-react";
import { useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { PERIOD_COLORS, type PeriodColor } from "@/lib/class-periods/colors";

import styles from "./period-color-field.module.css";

export function PeriodColorField({
  color = "#0F766E",
  label = "Колір шкали",
  form,
  disabled = false,
  hideLabel = false,
}: {
  color?: PeriodColor;
  label?: string;
  form?: string;
  disabled?: boolean;
  hideLabel?: boolean;
}) {
  const paletteId = useId();
  const selectedRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState(color);
  const { pending: formPending } = useFormStatus();
  const pending = formPending || disabled;
  const selectedOption = PERIOD_COLORS.find((option) => option.value === selected) ?? PERIOD_COLORS[0];

  return (
    <div className={styles.field}>
      {!hideLabel && <span>Колір шкали</span>}
      <input form={form} type="hidden" name="color" value={selected} />
      <Popover.Root>
        <Popover.Trigger
          className={styles.trigger}
          type="button"
          disabled={pending}
          aria-label={`${label}: ${selectedOption.name}`}
          style={{ backgroundColor: selected, color: selectedOption.foreground }}
        >
          <ChevronDown size={16} aria-hidden="true" />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner className={styles.positioner} sideOffset={8} collisionPadding={16} align="start">
            <Popover.Popup className={styles.popup} initialFocus={selectedRef}>
              <Popover.Title className="sr-only">{label}</Popover.Title>
              <fieldset className={styles.palette} disabled={pending}>
                <legend className="sr-only">Оберіть колір</legend>
                {PERIOD_COLORS.map((option) => (
                  <label key={option.value} className={styles.option}>
                    <input
                      ref={selected === option.value ? selectedRef : undefined}
                      type="radio"
                      name={`period-color-${paletteId}`}
                      value={option.value}
                      checked={selected === option.value}
                      onChange={() => setSelected(option.value)}
                      aria-label={option.name}
                    />
                    <span
                      className={styles.swatch}
                      style={{ backgroundColor: option.value, color: option.foreground }}
                      aria-hidden="true"
                    >
                      {selected === option.value ? <Check size={20} strokeWidth={2.5} /> : null}
                    </span>
                  </label>
                ))}
              </fieldset>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
