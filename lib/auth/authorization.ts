import type { AccountApproval, AppRole } from "./roles";

export function isApprovedAdministrator<T extends { role: AppRole; approval: AccountApproval }>(
  user: T | null | undefined,
): user is T & { role: "administrator"; approval: "approved" } {
  return user?.role === "administrator" && user.approval === "approved";
}
