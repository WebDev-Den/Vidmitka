import { describe, expect, it } from "vitest";
import { parseSnapshot, type ScheduleSnapshot, type TransferData } from "./schema";
import { planSnapshot } from "./plan";

function empty(): TransferData {
  return { groups: [], teachers: [], disciplines: [], rooms: [], lessonTypes: [], periods: [], entries: [], exceptions: [], calendar: [], weeks: [] };
}
function file(data = empty()): ScheduleSnapshot {
  return { format: "vidmitka-schedule", version: 1, exportedAt: "2026-09-05T12:00:00Z", data };
}
const group = { id: "dc9e792a-a129-4f9b-b31d-a6bbd46cb64c", code: "КІ-26", faculty: null, course: 1, study_form: null, is_active: true };

describe("schedule JSON transfer", () => {
  it("accepts its own JSON round trip and reports unchanged records without altering input", () => {
    const original = file({ ...empty(), groups: [group] });
    const encoded = JSON.stringify(original);
    const parsed = parseSnapshot(JSON.parse(encoded));
    const plan = planSnapshot(parsed.data, original.data);
    expect(plan.errors).toEqual([]);
    expect(plan.counts.find((row) => row.section === "groups")).toEqual({ section: "groups", label: "Групи", created: 0, updated: 0, unchanged: 1 });
    expect(JSON.stringify(original)).toBe(encoded);
  });
  it("distinguishes additions, updates and records absent from the file without deleting them", () => {
    const current = { ...empty(), groups: [group] };
    const absent = planSnapshot(empty(), current);
    expect(absent.changed.groups).toEqual([]);
    const change = planSnapshot({ ...empty(), groups: [{ ...group, code: "КІ-26-1" }] }, current);
    expect(change.counts[0]).toMatchObject({ created: 0, updated: 1, unchanged: 0 });
    expect(planSnapshot(current, empty()).counts[0]).toMatchObject({ created: 1, updated: 0 });
  });
  it("rejects unsupported versions, unknown fields, duplicate IDs and invalid dates", () => {
    expect(() => parseSnapshot({ ...file(), version: 2 })).toThrow();
    expect(() => parseSnapshot(file({ ...empty(), groups: [{ ...group, password: "must-not-import" }] }))).toThrow();
    expect(() => parseSnapshot(file({ ...empty(), groups: [group, group] }))).toThrow();
    expect(() => parseSnapshot(file({ ...empty(), calendar: [{ held_on: "2026-02-30", schedule_day: 1, week_type: "numerator", is_active: true }] }))).toThrow();
    expect(() => parseSnapshot({ ...file(), data: { ...empty(), app_users: [] } })).toThrow();
  });
  it("blocks ambiguous normalized names and overlapping active periods", () => {
    const incoming = { ...empty(), groups: [{ ...group, id: "646b328f-3d7b-481b-8207-68b51a1bf6eb", code: "кі-26" }] };
    expect(planSnapshot(incoming, { ...empty(), groups: [group] }).errors.join(" ")).toContain("іншому ID");
    const periods = [{ number: 1, start_minute: 480, end_minute: 560, is_active: true, color: "#0F766E" },
      { number: 2, start_minute: 550, end_minute: 620, is_active: true, color: "#0F766E" }];
    expect(planSnapshot({ ...empty(), periods }, empty()).errors.join(" ")).toContain("перетинається");
  });
  it("does not allow calendar updates on dates with attendance but permits unchanged exports", () => {
    const current = { ...empty(), calendar: [{ held_on: "2026-09-05", schedule_day: 1, week_type: "numerator", is_active: true }] };
    expect(planSnapshot(current, current, ["2026-09-05"]).errors).toEqual([]);
    const next = { ...empty(), calendar: [{ ...current.calendar[0], schedule_day: 2 }] };
    expect(planSnapshot(next, current, ["2026-09-05"]).errors.join(" ")).toContain("журналом");
  });
  it("reports broken references instead of permitting a partial import", () => {
    const data = { ...empty(), entries: [{ id: "499e34d1-a1cf-4f86-a21f-8126ab1cb0ca", discipline_id: group.id,
      lesson_type_id: group.id, period_number: 1, day_of_week: 1, week_pattern: "both", valid_from: null,
      valid_until: null, note: null, is_active: true, source_kind: null, source_id: null, source_payload_hash: null,
      group_ids: [group.id], teacher_ids: [group.id], room_ids: [] }] };
    expect(planSnapshot(parseSnapshot(file(data)).data, empty()).errors.join(" ")).toContain("відсутнє посилання");
  });
});
