import { beforeEach, describe, expect, it, vi } from "vitest";
const { authorize, add, revalidate } = vi.hoisted(() => ({ authorize: vi.fn(), add: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireAppUser: authorize }));
vi.mock("@/lib/lessons/roster", () => ({ addLessonStudents: add }));
vi.mock("next/cache", () => ({ revalidatePath: revalidate }));

import { addLessonStudentsAction } from "@/app/(private)/dashboard/my-lessons/[lessonId]/students/actions";
import { initialLessonState } from "@/app/(private)/dashboard/lessons/new/form-state";

beforeEach(() => {
  vi.resetAllMocks();
  authorize.mockResolvedValue({ id: "teacher", role: "teacher" });
  add.mockResolvedValue({ success: true, message: "Додано" });
});

function form() {
  const data = new FormData();
  data.set("lessonId", "12"); data.set("teacherId", "other-teacher");
  data.append("groupNames", "КН-21"); data.append("studentIds", "3");
  return data;
}

describe("додавання студентів після створення заняття", () => {
  it("бере актора із сесії, а не з форми", async () => {
    expect((await addLessonStudentsAction(initialLessonState, form())).success).toBe(true);
    expect(add).toHaveBeenCalledWith("teacher", "12", { groupNames: ["КН-21"], studentIds: ["3"] });
    expect(revalidate).toHaveBeenCalledWith("/dashboard/my-lessons/12/students");
    expect(revalidate).toHaveBeenCalledWith("/dashboard/journal");
  });
  it.each(["anonymous", "pending"])("перевіряє доступ %s", async (state) => {
    authorize.mockRejectedValue(new Error(state));
    await expect(addLessonStudentsAction(initialLessonState, form())).rejects.toThrow(state);
    expect(add).not.toHaveBeenCalled();
  });
  it("не виконує мутацію без ID заняття", async () => {
    const data = form(); data.delete("lessonId");
    expect((await addLessonStudentsAction(initialLessonState, data)).success).toBe(false);
    expect(add).not.toHaveBeenCalled();
  });
  it("повертає доменну відмову без revalidation", async () => {
    add.mockResolvedValue({ success: false, message: "Чуже заняття" });
    expect(await addLessonStudentsAction(initialLessonState, form())).toEqual({ success: false, message: "Чуже заняття" });
    expect(revalidate).not.toHaveBeenCalled();
  });
  it("приховує технічні подробиці помилки", async () => {
    add.mockRejectedValue(new Error("private database details"));
    const result = await addLessonStudentsAction(initialLessonState, form());
    expect(result.success).toBe(false); expect(result.message).not.toContain("private");
  });
});
