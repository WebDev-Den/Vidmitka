import { describe, expect, it } from "vitest";

import { validateStudentAssignment } from "./rules";

describe("validateStudentAssignment", () => {
  it("нормалізує ПІБ, групу та предмет нового студента", () => {
    expect(
      validateStudentAssignment({
        fullName: "  Анна   Ковальчук  ",
        groupName: " КН-21 ",
        subjectId: "12",
      }),
    ).toEqual({
      ok: true,
      value: {
        fullName: "Анна Ковальчук",
        groupName: "КН-21",
        subjectId: "12",
      },
    });
  });
});
