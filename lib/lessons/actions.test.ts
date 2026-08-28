import { beforeEach, describe, expect, it, vi } from "vitest";
const { authorize, create, addStudent, revalidate } = vi.hoisted(() => ({ authorize: vi.fn(), create: vi.fn(), addStudent: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireAppUser: authorize, requireTeacher: authorize }));
vi.mock("@/lib/lessons/create", () => ({ createLesson: create }));
vi.mock("@/lib/students/repository", () => ({ addStudentToTeacherSubject: addStudent, removeStudentFromTeacherSubject: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: revalidate }));
import { createLessonAction } from "@/app/(private)/dashboard/lessons/new/actions";
import { initialLessonState } from "@/app/(private)/dashboard/lessons/new/form-state";
import { addStudentAction } from "@/app/(private)/dashboard/students/actions";
import { initialStudentActionState } from "@/app/(private)/dashboard/students/form-state";

beforeEach(() => {
  vi.resetAllMocks(); authorize.mockResolvedValue({ id: "teacher", role: "teacher" });
  create.mockResolvedValue({ success: true, message: "created", lessonId: "10" });
  addStudent.mockResolvedValue({ success: true, message: "added" });
});
function form() {
  const data = new FormData();
  for (const [key, value] of Object.entries({ teacherId: "other", subjectId: "1", roomId: "1", classPeriodId: "1", lessonTypeId: "1", dayOfWeek: "1", weekType: "both" })) data.set(key, value);
  data.append("groupNames", "КН-21"); data.append("studentIds", "1"); data.append("studentIds", "2");
  return data;
}
describe("форми груп і занять", () => {
  it("передає порожні списки, коли групи та студенти не вибрані", async () => {
    const data = form(); data.delete("groupNames"); data.delete("studentIds");
    await createLessonAction(initialLessonState, data);
    expect(create).toHaveBeenCalledWith("teacher", "teacher", expect.objectContaining({ groupNames: [], studentIds: [] }));
  });
  it("не дозволяє викладачу підмінити власника заняття", async () => {
    await createLessonAction(initialLessonState, form());
    expect(create).toHaveBeenCalledWith("teacher", "teacher", expect.objectContaining({ studentIds: ["1", "2"], groupNames: ["КН-21"] }));
    expect(revalidate).toHaveBeenCalledWith("/dashboard/journal");
  });
  it("дозволяє адміністратору вибрати викладача", async () => {
    authorize.mockResolvedValue({ id: "administrator", role: "administrator" });
    await createLessonAction(initialLessonState, form());
    expect(create).toHaveBeenCalledWith("administrator", "other", expect.any(Object));
  });
  it.each(["anonymous", "pending"])("перевіряє доступ до обох форм: %s", async (state) => {
    authorize.mockRejectedValue(new Error(state));
    await expect(createLessonAction(initialLessonState, form())).rejects.toThrow(state);
    await expect(addStudentAction(initialStudentActionState, form())).rejects.toThrow(state);
    expect(create).not.toHaveBeenCalled(); expect(addStudent).not.toHaveBeenCalled();
  });
  it("передає наявну/нову групу окремо від власника", async () => {
    const data = form(); data.set("groupMode", "existing"); data.set("existingGroupName", "КН-21"); data.set("newGroupName", "КН-31");
    await addStudentAction(initialStudentActionState, data);
    expect(addStudent).toHaveBeenCalledWith(expect.objectContaining({ teacherUserId: "teacher", groupMode: "existing", existingGroupName: "КН-21", newGroupName: "КН-31" }));
  });
  it("показує конфлікт без успішного оновлення", async () => {
    create.mockResolvedValue({ success: false, message: "Конфлікт" });
    expect((await createLessonAction(initialLessonState, form())).message).toBe("Конфлікт");
    expect(revalidate).not.toHaveBeenCalled();
  });
});
