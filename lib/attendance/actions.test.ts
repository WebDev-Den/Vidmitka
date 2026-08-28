import { beforeEach, describe, expect, it, vi } from "vitest";
const { authorize, save, importRows, revalidate } = vi.hoisted(() => ({ authorize: vi.fn(), save: vi.fn(), importRows: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireTeacher: authorize }));
vi.mock("@/lib/attendance/repository", () => ({ saveAttendance: save }));
vi.mock("@/lib/students/import-repository", () => ({ importTeacherStudents: importRows }));
vi.mock("next/cache", () => ({ revalidatePath: revalidate }));
import { importStudentsAction, saveAttendanceAction } from "@/app/(private)/dashboard/journal/actions";
import { initialJournalState, initialStudentImportState } from "@/app/(private)/dashboard/journal/form-state";

beforeEach(() => {
  vi.resetAllMocks();
  authorize.mockResolvedValue({ id: "authenticated-teacher" });
  save.mockResolvedValue({ success: true, message: "saved" });
  importRows.mockResolvedValue({ success: true, message: "imported" });
});
const importForm = () => {
  const form = new FormData();
  form.set("lessonId", "12");
  form.set("teacherUserId", "forged-owner");
  form.set("studentsFile", new File([JSON.stringify([{ fullName: "Анна Ковальчук", groupName: "КН-21" }])], "students.json"));
  return form;
};
const attendanceForm = () => {
  const form = new FormData();
  for (const [key, value] of Object.entries({ date: "2026-08-27", lessonKey: "lesson:12", version: "0", calendarToken: "2026-08-27:0:4:unset", marks: '[{"studentId":"1","status":"not_required"}]', teacherUserId: "forged-owner" })) form.set(key, value);
  return form;
};
describe("дії журналу", () => {
  it("імпортує лише від імені викладача із сесії", async () => {
    expect((await importStudentsAction(initialStudentImportState, importForm())).success).toBe(true);
    expect(importRows).toHaveBeenCalledWith("authenticated-teacher", { lessonId: "12" }, [{ fullName: "Анна Ковальчук", groupName: "КН-21", subgroup: null }]);
    expect(revalidate).toHaveBeenCalledWith("/dashboard/journal");
  });
  it("передає статус виключення і версію збереження", async () => {
    expect((await saveAttendanceAction(initialJournalState, attendanceForm())).success).toBe(true);
    expect(save).toHaveBeenCalledWith("authenticated-teacher", { date: "2026-08-27", key: "lesson:12", version: 0, calendarToken: "2026-08-27:0:4:unset", marks: [{ studentId: "1", status: "not_required" }] });
  });
  it.each(["anonymous", "pending", "administrator"])("блокує обидві операції для %s", async (role) => {
    authorize.mockRejectedValue(new Error(`denied:${role}`));
    await expect(importStudentsAction(initialStudentImportState, importForm())).rejects.toThrow(`denied:${role}`);
    await expect(saveAttendanceAction(initialJournalState, attendanceForm())).rejects.toThrow(`denied:${role}`);
    expect(importRows).not.toHaveBeenCalled(); expect(save).not.toHaveBeenCalled();
  });
  it.each([new File([], "students.csv"), new File(["x".repeat(512 * 1024 + 1)], "students.csv"), new File(["invalid"], "students.json")])("не передає неправильний файл у БД %#", async (file) => {
    const form = importForm(); form.set("studentsFile", file);
    expect((await importStudentsAction(initialStudentImportState, form)).success).toBe(false);
    expect(importRows).not.toHaveBeenCalled();
  });
  it("показує помилку БД без внутрішніх даних", async () => {
    save.mockRejectedValue(new Error("sensitive database information"));
    const result = await saveAttendanceAction(initialJournalState, attendanceForm());
    expect(result.success).toBe(false); expect(result.message).not.toContain("sensitive");
    expect(revalidate).not.toHaveBeenCalled();
  });
  it("не зберігає зіпсований JSON відміток", async () => {
    const form = attendanceForm(); form.set("marks", "[");
    expect((await saveAttendanceAction(initialJournalState, form)).success).toBe(false);
    expect(save).not.toHaveBeenCalled();
  });
});
