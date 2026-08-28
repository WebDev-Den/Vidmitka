import { expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const cookie = vi.hoisted(() => ({ token: "" }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => cookie.token ? { value: cookie.token } : undefined }),
}));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => { throw new Error(`redirect:${path}`); },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import { createRoomAction, toggleRoomAction } from "@/app/(private)/dashboard/(admin)/rooms/actions";
import { initialRoomActionState } from "@/app/(private)/dashboard/(admin)/rooms/form-state";
import { createAuthSession } from "@/lib/auth/repository";
import { getDb } from "@/lib/db";
import { listRooms } from "@/lib/rooms/repository";

function roomForm(name: string): FormData {
  const form = new FormData();
  form.set("name", name);
  return form;
}

it.skipIf(!process.env.VIDMITKA_ATTENDANCE_TEST_SCHEMA)(
  "адміністратор керує аудиторіями; помилкові дані й сторонні користувачі не змінюють довідник",
  async () => {
    const sql = getDb();
    const [scope] = await sql`SELECT current_schema() AS name` as unknown as { name: string }[];
    expect(scope.name).toBe(process.env.VIDMITKA_ATTENDANCE_TEST_SCHEMA);
    expect(scope.name).toMatch(/^codex_attendance_test_[0-9a-f]{16}$/u);

    cookie.token = (await createAuthSession("administrator")).token;
    const initialCount = (await listRooms()).length;
    for (const name of ["", "   ", "А".repeat(101)]) {
      expect((await createRoomAction(initialRoomActionState, roomForm(name))).success).toBe(false);
    }
    expect(await listRooms()).toHaveLength(initialCount);

    const created = await createRoomAction(initialRoomActionState, roomForm("  Тестова   аудиторія  "));
    expect(created).toEqual({ success: true, message: "Аудиторію «Тестова аудиторія» додано." });
    const room = (await listRooms()).find((item) => item.name === "Тестова аудиторія");
    expect(room).toBeDefined();
    if (!room) throw new Error("Test room was not persisted");
    expect(room.isActive).toBe(true);

    expect(await createRoomAction(initialRoomActionState, roomForm("Тестова аудиторія"))).toEqual({
      success: false, message: "Аудиторія з такою назвою вже існує.",
    });
    expect(await listRooms()).toHaveLength(initialCount + 1);

    await toggleRoomAction(room.id, false);
    expect((await listRooms()).find((item) => item.id === room.id)?.isActive).toBe(false);
    expect((await listRooms({ activeOnly: true })).some((item) => item.id === room.id)).toBe(false);
    await toggleRoomAction(room.id, true);
    expect((await listRooms({ activeOnly: true })).some((item) => item.id === room.id)).toBe(true);

    cookie.token = (await createAuthSession("teacher")).token;
    await expect(createRoomAction(initialRoomActionState, roomForm("Без дозволу")))
      .rejects.toThrow("redirect:/dashboard?access=denied");
    await expect(toggleRoomAction(room.id, false)).rejects.toThrow("redirect:/dashboard?access=denied");

    await sql`UPDATE app_users SET approval_status = 'pending' WHERE id = 'other-teacher'`;
    cookie.token = (await createAuthSession("other-teacher")).token;
    await expect(createRoomAction(initialRoomActionState, roomForm("Без схвалення")))
      .rejects.toThrow("redirect:/approval-pending");
    await expect(toggleRoomAction(room.id, false)).rejects.toThrow("redirect:/approval-pending");

    cookie.token = "";
    await expect(createRoomAction(initialRoomActionState, roomForm("Без сесії")))
      .rejects.toThrow("redirect:/sign-in");
    await expect(toggleRoomAction(room.id, false)).rejects.toThrow("redirect:/sign-in");
    expect(await listRooms()).toHaveLength(initialCount + 1);
    expect((await listRooms()).find((item) => item.id === room.id)?.isActive).toBe(true);
  },
  120000,
);
