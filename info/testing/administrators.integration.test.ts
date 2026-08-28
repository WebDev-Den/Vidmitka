import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const cookie = vi.hoisted(() => ({ token: "" }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => cookie.token ? { value: cookie.token } : undefined }) }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
import { getDb } from "@/lib/db";
import { changeAccountRole, createAuthSession, findUserBySessionToken, isAdministratorRegistrationOpen, listStaffAccounts, registerAccount } from "@/lib/auth/repository";
import { requireAdministrator, requireTeacher } from "@/lib/auth/session";
import { changeRoleAction } from "@/app/(private)/dashboard/(admin)/teachers/actions";
import { signUpAction } from "@/app/(auth)/actions";
import { initialAuthActionState } from "@/app/(auth)/form-state";
import { importTeacherSchedule } from "@/lib/schedule-import/repository";
import { importTeacherStudents } from "@/lib/students/import-repository";
import { listSubjects } from "@/lib/subjects/repository";
import { listRooms } from "@/lib/rooms/repository";
import { listClassPeriods } from "@/lib/class-periods/repository";
import { addStudentToTeacherSubject, listTeacherStudents } from "@/lib/students/repository";
import { createLesson } from "@/lib/lessons/create";
import { listLessonTypes } from "@/lib/lesson-types/repository";
import { listJournalLessons, listJournalStudents, saveAttendance } from "@/lib/attendance/repository";
import { getDateKeyInTimeZone } from "@/lib/schedule-week/rules";

it.skipIf(!process.env.VIDMITKA_ATTENDANCE_TEST_SCHEMA)("код відкриває тільки початкову реєстрацію адміністратора", async () => {
  const sql = getDb();
  const [scope] = await sql`SELECT current_schema() AS name` as unknown as { name: string }[];
  expect(scope.name).toBe(process.env.VIDMITKA_ATTENDANCE_TEST_SCHEMA);
  expect(scope.name).toMatch(/^codex_attendance_test_[0-9a-f]{16}$/u);
  // Сервер відхиляє недійсний пароль навіть без клієнтської перевірки.
  for (const [password, confirmation, errorField] of [
    ["Ab1!?", "Ab1!?", "password"],
    ["abcdef1!", "abcdef1!", "password"],
    ["Abcdef!?", "Abcdef!?", "password"],
    ["Abcdef12", "Abcdef12", "password"],
    ["Abc1!?", "Abc2!?", "passwordConfirmation"],
    ["Abc1!?", "", "passwordConfirmation"],
  ] as const) {
    const form = new FormData();
    form.set("fullName", "Тест Валідації Реєстрації");
    form.set("email", "invalid-registration@example.test");
    form.set("password", password);
    form.set("passwordConfirmation", confirmation);
    const result = await signUpAction(initialAuthActionState, form);
    expect(result.success).toBe(false);
    expect(result.fieldErrors[errorField]).toBeTruthy();
    expect(result.values).toEqual({ fullName: "Тест Валідації Реєстрації", email: "invalid-registration@example.test" });
  }
  expect((await listStaffAccounts()).some((user) => user.email === "invalid-registration@example.test")).toBe(false);
  const input = { fullName: "Початковий Адміністратор", password: "Codex Attendance Test 2026!",
    administratorCode: "Codex Admin Bootstrap Test Only", email: "codex.attendance.administrator@example.test" };
  expect(await isAdministratorRegistrationOpen()).toBe(true);
  expect((await registerAccount({ ...input, administratorCode: "wrong" })).success).toBe(false);
  // Два одночасні запити: лише один може отримати захищену роль.
  const initial = await Promise.all([registerAccount(input), registerAccount({ ...input, email: "codex.attendance.second-admin@example.test" })]);
  expect(initial.filter((result) => result.success && result.user.role === "administrator")).toHaveLength(1);
  const first = initial.find((result) => result.success && result.user.role === "administrator")!;
  expect(first.success && first.user.isBootstrapAdministrator).toBe(true);
  expect(await isAdministratorRegistrationOpen()).toBe(false);
  const next = await registerAccount({ ...input, email: "codex.attendance.later@example.test" });
  expect(next.success && next.user.role).toBe("teacher");
  if (!first.success) throw new Error("Initial administrator was not created");
  if (!next.success) throw new Error("Pending account was not created");
  expect(next.user.approval).toBe("pending");
  expect(next.user.isBootstrapAdministrator).toBe(false);
  expect((await changeAccountRole("other-teacher", "other-teacher", "administrator")).success).toBe(false);
  expect((await changeAccountRole("missing", "teacher", "administrator")).success).toBe(false);
  expect((await changeAccountRole(first.user.id, next.user.id, "administrator")).success).toBe(false);
  expect((await changeAccountRole(first.user.id, "teacher", "owner")).success).toBe(false);
  expect((await changeAccountRole(first.user.id, "teacher", "administrator")).success).toBe(true);
  expect((await changeAccountRole("teacher", first.user.id, "teacher")).success).toBe(false);
  cookie.token = (await createAuthSession(first.user.id)).token;
  expect((await requireTeacher()).id).toBe(first.user.id);
  const subject = (await listSubjects({ activeOnly: true }))[0];
  const room = (await listRooms({ activeOnly: true }))[0];
  const period = (await listClassPeriods({ activeOnly: true }))[0];
  expect((await addStudentToTeacherSubject({ teacherUserId: first.user.id, fullName: "Тестенко Анна Олександрівна",
    groupMode: "new", newGroupName: "КН-51", existingGroupName: null, subjectId: subject.id })).success).toBe(true);
  const [student] = await listTeacherStudents(first.user.id);
  const date = getDateKeyInTimeZone(new Date());
  const day = new Date(`${date}T12:00:00Z`).getUTCDay() || 7;
  const created = await createLesson(first.user.id, first.user.id, { subjectId: subject.id, roomId: room.id,
    lessonTypeId: (await listLessonTypes({ activeOnly: true }))[0].id,
    classPeriodId: period.id, dayOfWeek: String(day), weekType: "both", studentIds: [student.studentId], groupNames: ["КН-51"] });
  expect(created.success).toBe(true);
  const [lesson] = (await listJournalLessons(first.user.id, date)).lessons;
  const roster = await listJournalStudents(first.user.id, lesson);
  expect(roster.map((item) => item.fullName)).toEqual(["Тестенко Анна Олександрівна"]);
  expect((await saveAttendance(first.user.id, { date, key: lesson.key, version: 0, calendarToken: (await listJournalLessons(first.user.id, date)).day!.token,
    marks: [{ studentId: student.studentId, status: "present" }] })).success).toBe(true);
  expect((await importTeacherStudents(first.user.id, { lessonId: lesson.lessonId! }, [
    { fullName: "Тестенко Богдан Олександрович", groupName: "КН-51", subgroup: null },
  ])).success).toBe(true);
  const secondPeriod = (await listClassPeriods({ activeOnly: true }))[1];
  expect((await importTeacherSchedule(first.user.id, [{ rowNumber: 1, subjectName: subject.name,
    roomName: room.name, periodNumber: secondPeriod.number, dayOfWeek: day, weekType: "both" }])).success).toBe(true);
  expect((await listJournalLessons(first.user.id, date)).lessons).toHaveLength(2);
  const promotedToken = (await createAuthSession("teacher")).token;
  expect((await findUserBySessionToken(promotedToken))?.role).toBe("administrator");
  const deniedForm = new FormData(); deniedForm.set("userId", first.user.id); deniedForm.set("role", "teacher");
  cookie.token = promotedToken;
  expect((await changeRoleAction({ success: false, message: "" }, deniedForm)).success).toBe(false);
  cookie.token = (await createAuthSession("other-teacher")).token;
  await expect(changeRoleAction({ success: false, message: "" }, deniedForm)).rejects.toThrow("redirect:/dashboard?access=denied");
  expect((await changeAccountRole(first.user.id, "teacher", "teacher")).success).toBe(true);
  expect((await findUserBySessionToken(promotedToken))?.role).toBe("teacher");
  cookie.token = promotedToken;
  expect((await requireTeacher()).id).toBe("teacher");
  await expect(requireAdministrator()).rejects.toThrow("redirect:/dashboard?access=denied");
  expect((await listStaffAccounts()).find((user) => user.id === first.user.id)?.isBootstrapAdministrator).toBe(true);
  cookie.token = (await createAuthSession(next.user.id)).token;
  await expect(requireTeacher()).rejects.toThrow("redirect:/approval-pending");
  cookie.token = "";
  await expect(requireTeacher()).rejects.toThrow("redirect:/sign-in");
  // Залишаємо стабільну тестову адресу початкового адміністратора для браузера.
  console.log(`Protected test administrator: ${first.user.email}`);
}, 120000);
