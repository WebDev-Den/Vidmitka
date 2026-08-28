"use client";

import { Combobox } from "@base-ui/react/combobox";
import { Check, ChevronDown, Plus, Search } from "lucide-react";
import { useId, useState } from "react";
import {
  canOfferDirectoryCreation, LESSON_DIRECTORIES, matchesDirectoryQuery, normalizeDirectoryQuery,
  type DirectoryCreateResult, type DirectoryOption, type LessonDirectoryKind,
} from "@/lib/lessons/directory-options";
import styles from "./directory-combobox.module.css";

type Item = DirectoryOption & { createName?: string };

export function DirectoryCombobox({ kind, options, value, onValueChange, onCreate, disabled, busy, creating, result }: {
  kind: LessonDirectoryKind;
  options: readonly DirectoryOption[];
  value: string;
  onValueChange: (id: string) => void;
  onCreate?: (name: string) => void;
  disabled: boolean;
  busy: boolean;
  creating: boolean;
  result: DirectoryCreateResult | null;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const config = LESSON_DIRECTORIES[kind];
  const name = normalizeDirectoryQuery(query);
  const canCreate = !!onCreate && canOfferDirectoryCreation(kind, query, options);
  const items: Item[] = canCreate
    ? [...options, { id: "create-option", name: `Додати «${name}»`, createName: name }]
    : [...options];

  return <div className={styles.field}>
    <Combobox.Root<Item>
      name={config.name} required disabled={disabled} readOnly={busy}
      items={items} value={options.find((option) => option.id === value) ?? null}
      itemToStringLabel={(item) => item.name}
      itemToStringValue={(item) => item.createName ? "" : item.id}
      isItemEqualToValue={(item, selected) => item.id === selected.id}
      filter={(item, input) => !!item.createName || matchesDirectoryQuery(item, input)}
      inputValue={query} onInputValueChange={setQuery}
      open={open} onOpenChange={(nextOpen) => {
        if (nextOpen && (busy || disabled)) return;
        setOpen(nextOpen);
        if (nextOpen) setQuery("");
      }}
      onValueChange={(item, details) => {
        if (busy || disabled) { details.cancel(); return; }
        if (item?.createName) {
          // A creation command is never a selected value or a submitted ID.
          details.cancel();
          setOpen(false);
          onCreate?.(item.createName);
        } else {
          onValueChange(item?.id ?? "");
          setQuery("");
        }
      }}
    >
      <Combobox.Label className={styles.label}>{config.label}</Combobox.Label>
      <Combobox.Trigger type="button" className={styles.trigger}
        aria-describedby={creating || result ? `${id}-message` : undefined}
        aria-disabled={busy || undefined} aria-busy={creating || undefined}>
        <span className={styles.value}><Combobox.Value placeholder={config.placeholder} /></span>
        <ChevronDown size={16} aria-hidden="true" />
      </Combobox.Trigger>
      <Combobox.Portal>
        <Combobox.Positioner className={styles.positioner} sideOffset={6} collisionPadding={16}>
          <Combobox.Popup className={styles.popup} aria-label={`Пошук і вибір: ${config.label}`}>
            <div className={styles.search}>
              <Search size={17} aria-hidden="true" />
              <Combobox.Input className={styles.input} placeholder="Пошук за назвою…"
                aria-label={`Пошук: ${config.label}`} />
            </div>
            <Combobox.Empty className={styles.empty}>
              {onCreate ? "Нічого не знайдено. Введіть назву, щоб додати запис."
                : "Нічого не знайдено. Відсутній запис може додати адміністратор."}
            </Combobox.Empty>
            <Combobox.List className={styles.list}>
              {(item: Item) => <Combobox.Item key={item.id} value={item}
                className={`${styles.item} ${item.createName ? styles.create : ""}`}>
                <span className={styles.indicator} aria-hidden="true">
                  {item.createName ? <Plus size={17} /> : <Combobox.ItemIndicator><Check size={17} /></Combobox.ItemIndicator>}
                </span>
                <span>{item.name}</span>
              </Combobox.Item>}
            </Combobox.List>
            {!!onCreate && !!name && (name.length < config.minLength || name.length > config.maxLength) &&
              <p className={styles.hint}>Для додавання: від {config.minLength} до {config.maxLength} символів.</p>}
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
    <div id={`${id}-message`} className={result && !result.success ? styles.error : styles.message}
      role={result && !result.success ? "alert" : "status"} aria-atomic="true">
      {creating ? "Додавання запису…" : result?.message}
    </div>
  </div>;
}
