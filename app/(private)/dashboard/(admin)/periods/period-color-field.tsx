"use client";

import { ColorField } from "@/components/color-field";
import type { PeriodColor } from "@/lib/class-periods/colors";

export function PeriodColorField(props: {
  color?: PeriodColor; label?: string; form?: string; disabled?: boolean; hideLabel?: boolean;
}) {
  return <ColorField label="Колір шкали" {...props} />;
}
