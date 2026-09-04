import { describe, expect, it, vi } from "vitest";
import { verifyBearer } from "./auth";
import { handleApiRequest, type ApiDependencies } from "./handler";
import { entryContract, activationContract } from "./contracts";
import { ApiError, readJson, validateObject } from "./http";

function dependencies(): ApiDependencies {
  return {
    authorize: vi.fn(async () => "c5ee4a65-f486-4e32-a8d2-c7ca426dab82"),
    collection: vi.fn(async () => ({ data: { success: true, id: "resource" }, status: 201, location: "/api/v1/groups/resource" })),
    import: vi.fn(async () => ({ data: { canCommit: true } })),
    getWeeks: vi.fn(async () => null), saveWeeks: vi.fn(async () => ({ success: true, message: "Збережено" })),
    schedule: vi.fn(async () => ({ date: "2026-09-04", calendarDayOfWeek: 5, scheduleDayOfWeek: 5, weekType: "numerator" as const, weekConfigured: true, isTransfer: false, items: [] })),
    invalidate: vi.fn(),
  };
}
describe("REST API boundaries", () => {
  it("authenticates before a mutation and does not leak the key", async () => {
    const deps = { ...dependencies(), authorize: vi.fn(async () => { throw new ApiError(401, "UNAUTHORIZED", "Ключ не прийнято."); }) };
    const request = new Request("https://example.test/api/v1/groups", { method: "POST", headers: { Authorization: "Bearer private-value" }, body: "invalid json" });
    const result = await handleApiRequest(request, ["groups"], deps);
    expect(result.status).toBe(401);
    expect(result.headers.get("WWW-Authenticate")).toBe("Bearer");
    expect(await result.text()).not.toContain("private-value");
    expect(deps.collection).not.toHaveBeenCalled();
    expect(deps.invalidate).not.toHaveBeenCalled();
  });
  it("returns a created ID, Location, no-store and invalidates the schedule", async () => {
    const deps = dependencies();
    const result = await handleApiRequest(new Request("https://example.test/api/v1/groups", { method: "POST" }), ["groups"], deps);
    expect(result.status).toBe(201);
    expect(result.headers.get("Location")).toBe("/api/v1/groups/resource");
    expect(result.headers.get("Cache-Control")).toBe("no-store");
    expect(await result.json()).toMatchObject({ data: { id: "resource" }, requestId: expect.any(String) });
    expect(deps.invalidate).toHaveBeenCalledOnce();
  });
  it("does not invalidate on import preview", async () => {
    const deps = dependencies();
    await handleApiRequest(new Request("https://example.test/api/v1/imports/preview", { method: "POST" }), ["imports", "preview"], deps);
    expect(deps.invalidate).not.toHaveBeenCalled();
  });
  it.each(["23503", "23001"])("returns safe FK conflict for SQLSTATE %s without SQL details", async (code) => {
    const deps = { ...dependencies(), collection: vi.fn(async () => { throw Object.assign(new Error("secret SQL and connection"), { code }); }) };
    const result = await handleApiRequest(new Request("https://example.test/api/v1/periods/1", { method: "DELETE" }), ["periods", "1"], deps);
    expect(result.status).toBe(409);
    expect(await result.text()).not.toContain("secret SQL");
    expect(deps.invalidate).not.toHaveBeenCalled();
  });
  it("rejects invalid calendar dates before the schedule resolver", async () => {
    const deps = dependencies();
    const result = await handleApiRequest(new Request("https://example.test/api/v1/schedule?date=2026-02-30"), ["schedule"], deps);
    expect(result.status).toBe(400);
    expect(deps.schedule).not.toHaveBeenCalled();
  });
  it("validates a Bearer key case-sensitively and fails closed on empty config", () => {
    const key = "Aa12345678901234567890123456789012";
    expect(verifyBearer(`Bearer ${key}`, key)).toBe(true);
    expect(verifyBearer(`Bearer ${key.toLowerCase()}`, key)).toBe(false);
    expect(verifyBearer(null, key)).toBe(false);
    expect(verifyBearer(`Bearer ${key}`, undefined)).toBe(false);
  });
  it("rejects unknown fields, wrong boolean types and invalid IDs instead of dropping them", () => {
    expect(() => validateObject({ isActive: "false" }, activationContract)).toThrow(ApiError);
    expect(() => validateObject({ isActive: true, createdByUserId: "someone" }, activationContract)).toThrow(ApiError);
    expect(() => validateObject({ disciplineId: "bad", groupIds: ["bad"] }, entryContract)).toThrow(ApiError);
  });
  it("limits streamed bodies and reports malformed JSON/content type", async () => {
    const oversized = new Request("https://example.test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ value: "x".repeat(100) }) });
    await expect(readJson(oversized, 32)).rejects.toMatchObject({ status: 413 });
    await expect(readJson(new Request("https://example.test", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" }))).rejects.toMatchObject({ status: 400 });
    await expect(readJson(new Request("https://example.test", { method: "POST", body: "{}" }))).rejects.toMatchObject({ status: 415 });
  });
});
