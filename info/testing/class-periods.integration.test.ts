import { expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const cookie = vi.hoisted(() => ({ token: "" }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => cookie.token ? { value: cookie.token } : undefined }),
}));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import { createClassPeriodAction, updateClassPeriodAction } from "@/app/(private)/dashboard/(admin)/periods/actions";
import { initialPeriodActionState } from "@/app/(private)/dashboard/(admin)/periods/form-state";
import { createAuthSession } from "@/lib/auth/repository";
import { listClassPeriods, type ClassPeriod } from "@/lib/class-periods/repository";
import { getDayTimeline } from "@/lib/class-periods/timeline";
import { getDb } from "@/lib/db";

function periodForm(period: Pick<ClassPeriod, "number" | "startTime" | "endTime">, color: string, intent = "save") {
  const form = new FormData();
  form.set("number", String(period.number));
  form.set("startTime", period.startTime);
  form.set("endTime", period.endTime);
  form.set("color", color);
  form.set("intent", intent);
  return form;
}

it.skipIf(!process.env.VIDMITKA_ATTENDANCE_TEST_SCHEMA)(
  "адміністратор зберігає кольори пар; публічна шкала використовує їх, сторонні користувачі не змінюють довідник",
  async () => {
    const sql = getDb();
    const [scope] = await sql`SELECT current_schema() AS name` as unknown as { name: string }[];
    expect(scope.name).toBe(process.env.VIDMITKA_ATTENDANCE_TEST_SCHEMA);
    expect(scope.name).toMatch(/^codex_attendance_test_[0-9a-f]{16}$/u);

    const original = await listClassPeriods();
    const first = original[0];
    expect(first).toBeDefined();
    cookie.token = (await createAuthSession("administrator")).token;

    const updated = await updateClassPeriodAction(first.id, initialPeriodActionState, periodForm(first, " #a855f7 "));
    expect(updated.success).toBe(true);
    expect((await listClassPeriods()).find((period) => period.id === first.id)).toEqual({ ...first, color: "#A855F7" });
    const timeline = getDayTimeline(await listClassPeriods(), new Date("2026-08-28T05:30:00Z"));
    expect(timeline.currentSegment).toMatchObject({ kind: "period", number: first.number, color: "#A855F7" });

    const newPeriod = { number: 9, startTime: "21:00", endTime: "21:40" };
    expect((await createClassPeriodAction(initialPeriodActionState, periodForm(newPeriod, "#123ABC"))).success).toBe(true);
    const ninth = (await listClassPeriods()).find((period) => period.number === 9);
    expect(ninth).toMatchObject({ ...newPeriod, color: "#123ABC", isActive: true });
    if (!ninth) throw new Error("Test period was not persisted");

    // Same color is allowed on different pairs; time and number conflict rules still apply.
    expect((await updateClassPeriodAction(ninth.id, initialPeriodActionState, periodForm(ninth, "#A855F7"))).success).toBe(true);
    expect((await listClassPeriods()).find((period) => period.id === ninth.id)?.color).toBe("#A855F7");
    expect((await createClassPeriodAction(initialPeriodActionState, periodForm(newPeriod, "#243B3A"))).success).toBe(false);
    expect((await createClassPeriodAction(initialPeriodActionState, periodForm({ number: 10, startTime: "08:15", endTime: "09:00" }, "#243B3A"))).success).toBe(false);
    for (const color of ["", "purple", "#GGGGGG", "#12345678", "url(https://example.test)"]) {
      expect((await updateClassPeriodAction(first.id, initialPeriodActionState, periodForm(first, color))).success).toBe(false);
    }
    const missingColor = periodForm(first, "#0F766E");
    missingColor.delete("color");
    expect((await updateClassPeriodAction(first.id, initialPeriodActionState, missingColor)).success).toBe(false);
    expect(await listClassPeriods()).toHaveLength(original.length + 1);
    expect((await listClassPeriods()).find((period) => period.id === first.id)?.color).toBe("#A855F7");

    expect((await updateClassPeriodAction(first.id, initialPeriodActionState, periodForm(first, "#A855F7", "deactivate"))).success).toBe(true);
    const inactive = (await listClassPeriods()).find((period) => period.id === first.id);
    expect(inactive).toMatchObject({ isActive: false, color: "#A855F7" });
    expect(getDayTimeline(await listClassPeriods(), new Date("2026-08-28T05:30:00Z")).segments.some((segment) => segment.id === first.id)).toBe(false);
    expect((await updateClassPeriodAction(first.id, initialPeriodActionState, periodForm(first, "#A855F7", "activate"))).success).toBe(true);

    await sql`UPDATE app_users SET approval_status = 'pending' WHERE id = 'other-teacher'`;
    const forbidden = [
      { id: "teacher", redirect: "/dashboard?access=denied" },
      { id: "other-teacher", redirect: "/approval-pending" },
      { id: null, redirect: "/sign-in" },
    ];
    for (const actor of forbidden) {
      cookie.token = actor.id ? (await createAuthSession(actor.id)).token : "";
      await expect(createClassPeriodAction(initialPeriodActionState, periodForm({ ...newPeriod, number: 10 }, "#DED9CD")))
        .rejects.toThrow(`redirect:${actor.redirect}`);
      for (const intent of ["save", "deactivate"]) {
        await expect(updateClassPeriodAction(first.id, initialPeriodActionState, periodForm(first, "#DED9CD", intent)))
          .rejects.toThrow(`redirect:${actor.redirect}`);
      }
    }
    expect((await listClassPeriods()).find((period) => period.id === first.id)).toMatchObject({ isActive: true, color: "#A855F7" });
    expect(await listClassPeriods()).toHaveLength(original.length + 1);
  },
  120000,
);
