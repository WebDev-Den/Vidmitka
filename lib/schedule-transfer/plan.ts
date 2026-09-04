import { definitions, equalRows, normalizeName, type TransferData, type TransferRow } from "./schema";

export type TransferCount = { section: string; label: string; created: number; updated: number; unchanged: number };
export type TransferPreview = { counts: TransferCount[]; errors: string[]; warnings: string[] };
export type TransferPlan = TransferPreview & { changed: TransferData };

/** Read-only simulation of the merged state; no SQL, writes, sequences or audit rows. */
export function planSnapshot(incoming: TransferData, current: TransferData, journalDates: readonly string[] = []): TransferPlan {
  const errors: string[] = [], warnings: string[] = [], counts: TransferCount[] = [];
  const changed: TransferData = {}, merged: TransferData = {};
  const indexes: Record<string, Map<string, TransferRow>> = {};
  for (const [section, definition] of Object.entries(definitions)) {
    const index = new Map(current[section].map((row) => [String(row[definition.key]), row]));
    const count = { section, label: definition.label, created: 0, updated: 0, unchanged: 0 };
    changed[section] = [];
    for (const row of incoming[section]) {
      const id = String(row[definition.key]), existing = index.get(id);
      if (existing && equalRows(row, existing)) count.unchanged++;
      else {
        count[existing ? "updated" : "created"]++;
        changed[section].push(row);
      }
      index.set(id, row);
    }
    merged[section] = [...index.values()]; indexes[section] = index; counts.push(count);
  }
  const error = (message: string) => { if (errors.length < 100) errors.push(message); };
  for (const [section, definition] of Object.entries(definitions)) {
    for (const [name, field] of Object.entries(definition.fields)) {
      if (field.normalized || name === "internal_code") {
        const seen = new Map<string, string>();
        for (const row of merged[section]) {
          if (row[name] === null) continue;
          const key = normalizeName(row[name]), id = String(row[definition.key]);
          if (seen.has(key) && seen.get(key) !== id) error(`${definition.label}: назва / код «${row[name]}» уже належить іншому ID. Об’єднайте ці записи у файлі.`);
          seen.set(key, id);
        }
      }
      if (field.ref) for (const row of merged[section]) {
        if (row[name] !== null && !indexes[field.ref].has(String(row[name]))) error(`${definition.label}: ${row[definition.key]} — відсутнє посилання ${name}: ${row[name]}.`);
      }
    }
    for (const [name, link] of Object.entries(definition.links ?? {})) {
      for (const row of merged[section]) for (const id of row[name] as string[]) {
        if (!indexes[link.ref].has(id)) error(`${definition.label}: ${row.id} — відсутнє посилання ${name}: ${id}.`);
      }
    }
    const sourceIds = new Set<string>();
    for (const row of merged[section]) if (row.source_kind && row.source_id) {
      const key = JSON.stringify([row.source_kind, row.source_id]);
      if (sourceIds.has(key)) error(`${definition.label}: повторний source_id імпортованого запису.`);
      sourceIds.add(key);
    }
  }
  const periods = merged.periods.filter((row) => row.is_active);
  for (const row of merged.periods) if (Number(row.start_minute) >= Number(row.end_minute)) error(`Пара ${row.number}: завершення має бути після початку.`);
  for (let i = 0; i < periods.length; i++) for (let j = i + 1; j < periods.length; j++) {
    if (Number(periods[i].start_minute) < Number(periods[j].end_minute) && Number(periods[j].start_minute) < Number(periods[i].end_minute)) {
      error(`Час активних пар ${periods[i].number} та ${periods[j].number} перетинається.`);
    }
  }
  for (const row of merged.entries) {
    if (row.valid_from && row.valid_until && String(row.valid_from) > String(row.valid_until)) error(`Заняття ${row.id}: некоректний період дії.`);
    if (!(row.group_ids as string[]).length || !(row.teacher_ids as string[]).length) error(`Заняття ${row.id}: потрібні група й викладач.`);
  }
  for (const row of changed.entries.filter((item) => item.is_active)) {
    for (const [name, field] of Object.entries(definitions.entries.fields)) {
      if (field.ref && indexes[field.ref].get(String(row[name]))?.is_active === false) error(`Заняття ${row.id}: ${name} посилається на неактивний запис.`);
    }
    for (const [name, link] of Object.entries(definitions.entries.links!)) {
      if ((row[name] as string[]).some((id) => indexes[link.ref].get(id)?.is_active === false)) error(`Заняття ${row.id}: ${name} містить неактивні записи.`);
    }
  }
  for (const row of merged.exceptions) {
    const fail = (message: string) => error(`Виняток ${row.id}: ${message}`);
    if (row.kind !== "one_time" && !row.base_entry_id) fail("потрібне базове заняття.");
    if (["move", "reschedule"].includes(String(row.kind)) && !row.new_date) fail("потрібна нова дата.");
    if (row.kind === "one_time" && (!row.discipline_id || !row.lesson_type_id || !row.period_number || !(row.group_ids as string[]).length || !(row.teacher_ids as string[]).length)) fail("заповніть пару, дисципліну, тип, групи й викладачів.");
    if (row.kind === "room_change" && !(row.room_ids as string[]).length) fail("потрібна аудиторія.");
    if (row.kind === "teacher_change" && !(row.teacher_ids as string[]).length) fail("потрібен викладач.");
    if (row.kind === "discipline_change" && !row.discipline_id) fail("потрібна дисципліна.");
    if (row.kind === "type_change" && !row.lesson_type_id) fail("потрібен тип заняття.");
    if (row.kind === "reschedule" && !row.period_number && !row.custom_start_time) fail("потрібна пара або власний час.");
    if ((row.custom_start_time || row.custom_end_time) && (!row.custom_start_time || !row.custom_end_time || String(row.custom_start_time) >= String(row.custom_end_time))) fail("некоректний власний час.");
  }
  for (const row of merged.weeks) if (row.semester_start && row.semester_end && String(row.semester_start) > String(row.semester_end)) error("Завершення семестру має бути після початку.");
  for (const row of changed.calendar) if (journalDates.includes(String(row.held_on))) error(`${row.held_on}: календар захищений наявним журналом відвідуваності.`);
  // Report new recurring collisions; historical unchanged collisions do not block round trips.
  const changedIds = new Set(changed.entries.map((row) => row.id));
  const activeEntries = merged.entries.filter((row) => row.is_active);
  const warned = new Set<string>();
  for (const a of activeEntries) {
    if (!changedIds.has(a.id)) continue;
    for (const b of activeEntries) {
      if (a.id === b.id || a.day_of_week !== b.day_of_week || a.period_number !== b.period_number ||
        (a.week_pattern !== "both" && b.week_pattern !== "both" && a.week_pattern !== b.week_pattern) ||
        String(a.valid_from ?? "0001") > String(b.valid_until ?? "9999") || String(b.valid_from ?? "0001") > String(a.valid_until ?? "9999")) continue;
      const key = [a.id, b.id].sort().join(":");
      if (!warned.has(key) && ["group_ids", "teacher_ids", "room_ids"].some((field) => (a[field] as string[]).some((id) => (b[field] as string[]).includes(id)))) {
        if (warnings.length < 100) warnings.push(`Конфлікт у ${a.period_number} парі, день ${a.day_of_week}: заняття ${a.id} та ${b.id} мають спільну групу, викладача або аудиторію.`);
        warned.add(key);
      }
    }
  }
  return { counts, changed, errors, warnings };
}
