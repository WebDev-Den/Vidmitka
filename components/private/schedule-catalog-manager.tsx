"use client";

import { Save, Search, Trash2 } from "lucide-react";
import { useActionState, useEffect, useId, useMemo, useState } from "react";

import { ColorField } from "@/components/color-field";
import { ManagementStatus, ManagementTable } from "@/components/private/management-table";
import type { CatalogMutationResult, ScheduleCatalogEntry } from "@/lib/schedule-v2/catalog-types";
import type { HexColor } from "@/lib/ui/colors";

const initialState: CatalogMutationResult = { success: false, message: "" };

type CatalogDraft = Readonly<{ name: string; color?: HexColor }>;

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
  const [drafts, setDrafts] = useState<Record<string, CatalogDraft>>({});
  const createFormId = useId();
  const batchFormId = useId();
  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("uk-UA");
    const filtered = normalized ? entries.filter((entry) => entry.name.toLocaleLowerCase("uk-UA").includes(normalized)) : [...entries];
    return [...filtered].sort((left, right) => left.name.localeCompare(right.name, "uk-UA") * (descending ? -1 : 1));
  }, [descending, entries, query]);
  const pageCount = Math.max(1, Math.ceil(visible.length / 25));
  const currentPage = Math.min(page, pageCount - 1);
  const pagedEntries = visible.slice(currentPage * 25, currentPage * 25 + 25);
  const changedEntries = entries.filter((entry) => drafts[entry.id] !== undefined);
  const hasChanges = changedEntries.length > 0;
  const encodedChanges = JSON.stringify(changedEntries.map((entry) => {
    const draft = drafts[entry.id]!;
    return {
      id: entry.id,
      name: draft.name,
      ...(withColor ? { color: draft.color ?? entry.color ?? "#0F766E" } : {}),
    };
  }));

  useEffect(() => setDrafts({}), [entries]);

  const updateDraft = (entry: ScheduleCatalogEntry, patch: Partial<CatalogDraft>) => {
    setDrafts((previous) => {
      const current = previous[entry.id] ?? { name: entry.name, color: entry.color };
      const next = { ...current, ...patch };
      const unchanged = next.name === entry.name && (!withColor || next.color === entry.color);
      if (unchanged) {
        const { [entry.id]: _discarded, ...rest } = previous;
        return rest;
      }
      return { ...previous, [entry.id]: next };
    });
  };

  return <div className="management-stack">
    <label className="management-search"><Search size={17} aria-hidden="true" />
      <span className="sr-only">Пошук у довіднику</span>
      <input type="search" value={query} onChange={(event) => { setQuery(event.currentTarget.value); setPage(0); }}
        placeholder="Пошук за назвою" />
    </label>
    <div className="management-actions"><button className="button button-light" type="button" onClick={() => setDescending((value) => !value)}>
      Сортування: {descending ? "Я–А" : "А–Я"}
    </button><span className="management-muted">{visible.length} записів</span></div>
    {hasChanges ? <div className="management-actions" role="status" aria-live="polite">
      <span className="management-muted">Змінено рядків: {changedEntries.length}</span>
      <button form={batchFormId} className="button button-primary" disabled={pending}>
        <Save size={16} aria-hidden="true" /> {pending ? "Збереження…" : `Зберегти зміни (${changedEntries.length})`}
      </button>
    </div> : null}
    {state.message ? <p className={`period-action-message ${state.success ? "is-success" : "is-error"}`}
      role={state.success ? "status" : "alert"}>{state.message}</p> : null}
    <ManagementTable caption={caption} columns={[nameLabel, ...(withColor ? ["Колір"] : []), "Стан", "Дії"]}
      minWidth={withColor ? 820 : 700}>
      <tbody>
        <tr className="management-new-row">
          <td><input form={createFormId} name="name" type="text" aria-label={nameLabel}
            placeholder={nameLabel} required disabled={pending || hasChanges} /></td>
          {withColor ? <td><ColorField form={createFormId} hideLabel label="Колір нового типу" disabled={pending || hasChanges} /></td> : null}
          <td><span className="management-muted">Новий запис</span></td>
          <td><form id={createFormId} action={formAction}>
            <input type="hidden" name="operation" value="create" />
            <button className="button button-primary" disabled={pending || hasChanges}>{addLabel}</button>
          </form></td>
        </tr>
      </tbody>
      <tbody>{pagedEntries.map((entry) => {
        const draft = drafts[entry.id] ?? { name: entry.name, color: entry.color };
        const actionDisabled = pending || hasChanges;
        return <tr key={entry.id}>
          <th scope="row"><input name={`catalog-name-${entry.id}`} value={draft.name}
            onChange={(event) => updateDraft(entry, { name: event.currentTarget.value })}
            aria-label={`${nameLabel}: ${entry.name}`} required disabled={pending} /></th>
          {withColor ? <td><ColorField color={draft.color ?? entry.color ?? "#0F766E"} hideLabel
            label={`Колір: ${entry.name}`} disabled={pending}
            onValueChange={(color) => updateDraft(entry, { color })} /></td> : null}
          <td><ManagementStatus active={entry.isActive} feminine={caption.includes("аудитор")} /></td>
          <td className="management-actions-cell">
            <form action={formAction}>
              <input type="hidden" name="id" value={entry.id} />
              <button className="button button-light" name="operation"
                value={entry.isActive ? "deactivate" : "activate"} disabled={actionDisabled}
                title={hasChanges ? "Спершу збережіть або поверніть зміни." : undefined}>
                {entry.isActive ? "Деактивувати" : "Активувати"}
              </button>
            </form>
            <form action={formAction} onSubmit={(event) => {
              if (!window.confirm(`Видалити «${entry.name}»? Пов’язані записи блокують видалення.`)) event.preventDefault();
            }}>
              <input type="hidden" name="id" value={entry.id} />
              <button className="icon-control" name="operation" value="delete" disabled={actionDisabled}
                title={hasChanges ? "Спершу збережіть або поверніть зміни." : undefined}
                aria-label={`Видалити: ${entry.name}`}><Trash2 size={16} /></button>
            </form>
          </td>
        </tr>;
      })}
      {!visible.length ? <tr><td colSpan={withColor ? 4 : 3} className="management-muted">Записів не знайдено.</td></tr> : null}
      </tbody>
    </ManagementTable>
    <form id={batchFormId} action={formAction}>
      <input type="hidden" name="operation" value="batch-update" />
      <input type="hidden" name="changes" value={encodedChanges} />
    </form>
    {pageCount > 1 ? <nav className="management-actions" aria-label="Сторінки довідника">
      <button className="button button-light" type="button" disabled={currentPage === 0} onClick={() => setPage((value) => value - 1)}>Назад</button>
      <span>{currentPage + 1} / {pageCount}</span>
      <button className="button button-light" type="button" disabled={currentPage + 1 >= pageCount} onClick={() => setPage((value) => value + 1)}>Далі</button>
    </nav> : null}
  </div>;
}
