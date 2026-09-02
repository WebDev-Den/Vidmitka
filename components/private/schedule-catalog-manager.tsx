"use client";

import { Save, Search, Trash2 } from "lucide-react";
import { useActionState, useId, useMemo, useState } from "react";

import { ColorField } from "@/components/color-field";
import { ManagementStatus, ManagementTable } from "@/components/private/management-table";
import { ManagementSubmit } from "@/components/private/management-submit";
import type { CatalogMutationResult, ScheduleCatalogEntry } from "@/lib/schedule-v2/catalog-types";

const initialState: CatalogMutationResult = { success: false, message: "" };

export function ScheduleCatalogManager({ entries, action, caption, nameLabel, addLabel, withColor = false }: {
  entries: readonly ScheduleCatalogEntry[];
  action: (previousState: CatalogMutationResult, formData: FormData) => Promise<CatalogMutationResult>;
  caption: string;
  nameLabel: string;
  addLabel: string;
  withColor?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [query, setQuery] = useState("");
  const [descending, setDescending] = useState(false);
  const [page, setPage] = useState(0);
  const createFormId = useId();
  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("uk-UA");
    const filtered = normalized ? entries.filter((entry) => entry.name.toLocaleLowerCase("uk-UA").includes(normalized)) : [...entries];
    return [...filtered].sort((left, right) => left.name.localeCompare(right.name, "uk-UA") * (descending ? -1 : 1));
  }, [descending, entries, query]);
  const pageCount = Math.max(1, Math.ceil(visible.length / 25));
  const currentPage = Math.min(page, pageCount - 1);
  const pagedEntries = visible.slice(currentPage * 25, currentPage * 25 + 25);

  return <div className="management-stack">
    <label className="management-search"><Search size={17} aria-hidden="true" />
      <span className="sr-only">Пошук у довіднику</span>
      <input type="search" value={query} onChange={(event) => { setQuery(event.currentTarget.value); setPage(0); }}
        placeholder="Пошук за назвою" />
    </label>
    <div className="management-actions"><button className="button button-light" type="button" onClick={() => setDescending((value) => !value)}>
      Сортування: {descending ? "Я–А" : "А–Я"}
    </button><span className="management-muted">{visible.length} записів</span></div>
    {state.message ? <p className={`period-action-message ${state.success ? "is-success" : "is-error"}`}
      role={state.success ? "status" : "alert"}>{state.message}</p> : null}
    <ManagementTable caption={caption} columns={[nameLabel, ...(withColor ? ["Колір"] : []), "Стан", "Дії"]}
      minWidth={withColor ? 820 : 700}>
      <tbody>
        <tr className="management-new-row">
          <td><input form={createFormId} name="name" type="text" aria-label={nameLabel}
            placeholder={nameLabel} required disabled={pending} /></td>
          {withColor ? <td><ColorField form={createFormId} hideLabel label="Колір нового типу" /></td> : null}
          <td><span className="management-muted">Новий запис</span></td>
          <td><form id={createFormId} action={formAction}>
            <input type="hidden" name="operation" value="create" />
            <button className="button button-primary" disabled={pending}>{addLabel}</button>
          </form></td>
        </tr>
      </tbody>
      <tbody>{pagedEntries.map((entry) => {
        const formId = `catalog-${entry.id}`;
        return <tr key={entry.id}>
          <th scope="row"><input form={formId} name="name" defaultValue={entry.name}
            aria-label={`${nameLabel}: ${entry.name}`} required /></th>
          {withColor ? <td><ColorField form={formId} color={entry.color} hideLabel label={`Колір: ${entry.name}`} /></td> : null}
          <td><ManagementStatus active={entry.isActive} feminine={caption.includes("аудитор")} /></td>
          <td className="management-actions-cell">
            <form id={formId} action={formAction}>
              <input type="hidden" name="id" value={entry.id} />
              <input type="hidden" name="operation" value="update" />
              <ManagementSubmit className="button button-light" aria-label={`Зберегти: ${entry.name}`}><Save size={16} /> Зберегти</ManagementSubmit>
            </form>
            <form action={formAction}>
              <input type="hidden" name="id" value={entry.id} />
              <button className="button button-light" name="operation"
                value={entry.isActive ? "deactivate" : "activate"} disabled={pending}>
                {entry.isActive ? "Деактивувати" : "Активувати"}
              </button>
            </form>
            <form action={formAction} onSubmit={(event) => {
              if (!window.confirm(`Видалити «${entry.name}»? Пов’язані записи блокують видалення.`)) event.preventDefault();
            }}>
              <input type="hidden" name="id" value={entry.id} />
              <button className="icon-control" name="operation" value="delete" disabled={pending}
                aria-label={`Видалити: ${entry.name}`}><Trash2 size={16} /></button>
            </form>
          </td>
        </tr>;
      })}
      {!visible.length ? <tr><td colSpan={withColor ? 4 : 3} className="management-muted">Записів не знайдено.</td></tr> : null}
      </tbody>
    </ManagementTable>
    {pageCount > 1 ? <nav className="management-actions" aria-label="Сторінки довідника">
      <button className="button button-light" type="button" disabled={currentPage === 0} onClick={() => setPage((value) => value - 1)}>Назад</button>
      <span>{currentPage + 1} / {pageCount}</span>
      <button className="button button-light" type="button" disabled={currentPage + 1 >= pageCount} onClick={() => setPage((value) => value + 1)}>Далі</button>
    </nav> : null}
  </div>;
}
