import { describe, expect, it } from "vitest";

import { getRoleNavigation } from "./role-navigation";

describe("getRoleNavigation", () => {
  it("показує викладачу його заняття та створення заняття", () => {
    const ids = getRoleNavigation("teacher").map((item) => item.id);

    expect(ids).toContain("my-lessons");
    expect(ids).toContain("import-schedule");
    expect(ids).toContain("students");
    expect(ids).toContain("journal");
    expect(getRoleNavigation("teacher")[0].href).toBe("/dashboard/journal");
    expect(ids).toContain("create-lesson");
    expect(ids).not.toContain("teachers");
    expect(ids).not.toContain("settings");
    expect(ids).not.toContain("lesson-types");
  });

  it("показує адміністратору довідники та керування", () => {
    const ids = getRoleNavigation("administrator").map((item) => item.id);

    expect(ids).toContain("create-lesson");
    expect(ids).toContain("teachers");
    expect(ids).toContain("subjects");
    expect(ids).toContain("rooms");
    expect(ids).toContain("periods");
    expect(ids).toContain("lesson-types");
    expect(ids).toContain("settings");
    expect(ids).toContain("students");
    expect(ids).toContain("import-schedule");
    expect(ids).toContain("journal");
    expect(ids).toContain("my-lessons");
    expect(ids).toContain("profile");
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("залишає перегляд розкладу всередині приватного кабінету", () => {
    expect(getRoleNavigation("teacher").find((item) => item.id === "schedule")?.href)
      .toBe("/dashboard/schedule");
    expect(
      getRoleNavigation("administrator").find((item) => item.id === "schedule")
        ?.href,
    ).toBe("/dashboard/schedule");
  });
});
