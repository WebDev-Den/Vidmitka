"use client";

import { useId, useState } from "react";
import { useFormStatus } from "react-dom";

import { parseHexColor, type HexColor } from "@/lib/ui/colors";

import styles from "./color-field.module.css";

export function ColorField({
  color = "#0F766E",
  label = "Колір",
  form,
  disabled = false,
  hideLabel = false,
}: {
  color?: HexColor;
  label?: string;
  form?: string;
  disabled?: boolean;
  hideLabel?: boolean;
}) {
  const inputId = useId();
  const [selected, setSelected] = useState(color);
  const { pending: formPending } = useFormStatus();
  const pending = formPending || disabled;

  return (
    <div className={styles.field}>
      {!hideLabel && <label htmlFor={inputId}>{label}</label>}
      {/* Submit once; keep the picker outside the row form's native reset. */}
      <input form={form} type="hidden" name="color" value={selected} />
      <input
        id={inputId}
        className={styles.input}
        type="color"
        value={selected.toLowerCase()}
        onChange={(event) => {
          const next = parseHexColor(event.currentTarget.value);
          if (next) setSelected(next);
        }}
        aria-label={label}
        disabled={pending}
      />
    </div>
  );
}
