export type AppRole = "administrator" | "teacher";
export type AccountApproval = "approved" | "pending";

export function getRoleLabel(role: AppRole): string {
  return role === "administrator" ? "Адміністратор" : "Викладач";
}
