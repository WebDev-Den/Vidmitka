import { describe, expect, it } from "vitest";

import { getRoleNavigation } from "./role-navigation";

describe("getRoleNavigation", () => {
  it("показує єдину адміністративну навігацію", () => {
    const ids = getRoleNavigation("administrator").map((item) => item.id);

    expect(ids[0]).toBe("overview");
    expect(ids).toContain("schedule");
    expect(ids).toContain("groups");
    expect(ids).toContain("teachers");
    expect(ids).toContain("subjects");
    expect(ids).toContain("rooms");
    expect(ids).toContain("periods");
    expect(ids).toContain("lesson-types");
    expect(ids).toContain("settings");
    expect(ids).toContain("exceptions");
    expect(ids).toContain("import");
    expect(ids).toContain("push");
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("не повертає застаріле викладацьке меню", () => {
    expect(getRoleNavigation("teacher")).toEqual([]);
  });
});
