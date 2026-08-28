import type { ReactNode } from "react";

/** Row forms live inside cells; editable controls use the matching form attribute. */
export function ManagementTable({ caption, columns, children, minWidth = 640 }: {
  caption: string;
  columns: readonly string[];
  children: ReactNode;
  minWidth?: number;
}) {
  return <div className="management-table-scroll" role="region" aria-label={caption} tabIndex={0}>
    <table className="management-table" style={{ minWidth }}>
      <caption className="sr-only">{caption}</caption>
      <thead><tr>{columns.map((column) => <th key={column} scope="col">{column}</th>)}</tr></thead>
      {children}
    </table>
  </div>;
}

export function ManagementFeedback({ state, colSpan }: {
  state: Readonly<{ success: boolean; message: string }>;
  colSpan: number;
}) {
  return state.message ? <tr className="management-feedback"><td colSpan={colSpan}>
    <p className={`period-action-message ${state.success ? "is-success" : "is-error"}`}
      role={state.success ? "status" : "alert"}>{state.message}</p>
  </td></tr> : null;
}

export function ManagementStatus({ active, feminine = false }: { active: boolean; feminine?: boolean }) {
  return <span className={`management-status${active ? " is-active" : ""}`}>
    {active ? (feminine ? "Активна" : "Активний") : (feminine ? "Неактивна" : "Неактивний")}
  </span>;
}
