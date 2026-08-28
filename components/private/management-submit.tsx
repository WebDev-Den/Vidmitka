"use client";

import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";

export function ManagementSubmit({ children, disabled, ...props }: ComponentProps<"button">) {
  const { pending } = useFormStatus();
  return <button type="submit" {...props} disabled={disabled || pending}>
    {children}<span className="sr-only">{pending ? " — виконується" : ""}</span>
  </button>;
}
