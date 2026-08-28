import { beforeEach, describe, expect, it, vi } from "vitest";

const { authorize, subject, room, lessonType, revalidate } = vi.hoisted(() => ({
  authorize: vi.fn(), subject: vi.fn(), room: vi.fn(), lessonType: vi.fn(), revalidate: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({ requireAdministrator: authorize }));
vi.mock("@/lib/subjects/repository", () => ({ createSubjectOption: subject }));
vi.mock("@/lib/rooms/repository", () => ({ createRoomOption: room }));
vi.mock("@/lib/lesson-types/repository", () => ({ createLessonTypeOption: lessonType }));
vi.mock("next/cache", () => ({ revalidatePath: revalidate }));

import { createLessonDirectoryOption } from "@/app/(private)/dashboard/lessons/new/directory-actions";

const success = { success: true, message: "Додано", option: { id: "42", name: "Новий запис" } };
beforeEach(() => {
  vi.resetAllMocks();
  authorize.mockResolvedValue({ id: "administrator", role: "administrator" });
  for (const mutation of [subject, room, lessonType]) mutation.mockResolvedValue(success);
});

describe("швидке додавання з форми заняття", () => {
  it.each(["subject", "room", "lessonType"] as const)("повертає option для %s", async (kind) => {
    expect(await createLessonDirectoryOption(kind, "Новий запис")).toEqual(success);
    expect(authorize).toHaveBeenCalledOnce();
    const mutation = { subject, room, lessonType }[kind];
    if (kind === "lessonType") expect(mutation).toHaveBeenCalledWith("administrator", "Новий запис");
    else expect(mutation).toHaveBeenCalledWith("Новий запис");
    for (const other of [subject, room, lessonType].filter((fn) => fn !== mutation)) expect(other).not.toHaveBeenCalled();
    expect(revalidate).toHaveBeenCalledWith("/dashboard/lessons/new");
  });
  it.each(["teacher", "pending", "anonymous"])("не перехоплює відмову доступу %s", async (state) => {
    authorize.mockRejectedValue(new Error(`redirect:${state}`));
    for (const kind of ["subject", "room", "lessonType"]) {
      await expect(createLessonDirectoryOption(kind, "Без дозволу")).rejects.toThrow(`redirect:${state}`);
    }
    for (const mutation of [subject, room, lessonType]) expect(mutation).not.toHaveBeenCalled();
    expect(revalidate).not.toHaveBeenCalled();
  });
  it.each([["__proto__", "Назва"], ["room", null], ["subject", {}], ["lessonType", 42]])("відхиляє некоректний payload", async (kind, name) => {
    expect((await createLessonDirectoryOption(kind, name)).success).toBe(false);
    for (const mutation of [subject, room, lessonType]) expect(mutation).not.toHaveBeenCalled();
  });
  it("повертає помилку дубліката без фіктивного ID", async () => {
    const duplicate = { success: false, message: "Запис уже існує." };
    room.mockResolvedValue(duplicate);
    expect(await createLessonDirectoryOption("room", "101")).toEqual(duplicate);
    expect(revalidate).not.toHaveBeenCalled();
  });
  it("не розкриває внутрішню помилку сховища", async () => {
    subject.mockRejectedValue(new Error("internal connection details"));
    const result = await createLessonDirectoryOption("subject", "Новий запис");
    expect(result.success).toBe(false);
    expect(result).not.toHaveProperty("option");
    expect(result.message).not.toContain("internal");
    expect(revalidate).not.toHaveBeenCalled();
  });
});
