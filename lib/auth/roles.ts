export type AppRole = "administrator" | "teacher";
export type AccountApproval = "approved" | "pending";

export type AccountAccess = Readonly<{
  role: AppRole;
  approval: AccountApproval;
}>;

export function parseAdminEmails(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(/[;,\s]+/u)
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** Кандидат для початкової реєстрації; чинні права завжди читаються з БД. */
export function resolveRole(
  email: string | null | undefined,
  adminEmails = process.env.ADMIN_EMAILS,
): AppRole {
  const normalizedEmail = email?.trim().toLowerCase();

  if (!normalizedEmail) return "teacher";

  return parseAdminEmails(adminEmails).has(normalizedEmail)
    ? "administrator"
    : "teacher";
}

export function resolveAccountAccess(
  email: string | null | undefined,
  approvedByAdministrator: unknown,
  adminEmails = process.env.ADMIN_EMAILS,
): AccountAccess {
  const role = resolveRole(email, adminEmails);

  if (role === "administrator") {
    return { role, approval: "approved" };
  }

  return {
    role,
    approval: approvedByAdministrator === true ? "approved" : "pending",
  };
}

export function getRoleLabel(role: AppRole): string {
  return role === "administrator" ? "Адміністратор" : "Викладач";
}
