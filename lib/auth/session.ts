import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import {
  createAuthSession,
  findUserBySessionToken,
  revokeAuthSession,
  type AuthUser,
} from "./repository";
import {
  getRoleLabel,
  type AccountApproval,
  type AppRole,
} from "./roles";

const SESSION_COOKIE = process.env.NODE_ENV === "production"
  ? "__Host-vidmitka_session"
  : "vidmitka_session";

export type AppUser = Readonly<{
  id: string;
  email: string;
  name: string;
  initials: string;
  role: AppRole;
  roleLabel: string;
  approval: AccountApproval;
}>;

function getInitials(name: string, email: string): string {
  const parts = name.trim().split(/\s+/u).filter(Boolean);

  if (parts.length > 0) {
    return parts
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("");
  }

  return email.slice(0, 2).toUpperCase();
}

function toAppUser(user: AuthUser): AppUser {
  return {
    id: user.id,
    email: user.email,
    name: user.fullName,
    initials: getInitials(user.fullName, user.email),
    role: user.role,
    roleLabel: getRoleLabel(user.role),
    approval: user.approval,
  };
}

export const getOptionalAppUser = cache(async (): Promise<AppUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const user = await findUserBySessionToken(token);
  return user ? toAppUser(user) : null;
});

export async function startAppSession(userId: string): Promise<void> {
  const cookieStore = await cookies();
  const previousToken = cookieStore.get(SESSION_COOKIE)?.value;
  if (previousToken) await revokeAuthSession(previousToken);

  const { token, expiresAt } = await createAuthSession(userId);

  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function endAppSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) await revokeAuthSession(token);
  cookieStore.delete(SESSION_COOKIE);
}

export const getAuthenticatedAppUser = cache(async (): Promise<AppUser> => {
  const user = await getOptionalAppUser();
  if (!user) redirect("/sign-in");
  return user;
});

export async function requireAppUser(): Promise<AppUser> {
  const user = await getAuthenticatedAppUser();

  if (user.approval === "pending") redirect("/approval-pending");
  return user;
}

export async function requireAdministrator(): Promise<AppUser> {
  const user = await requireAppUser();

  if (user.role !== "administrator") redirect("/dashboard?access=denied");
  return user;
}

export async function requireTeacher(): Promise<AppUser> {
  // Обидві ролі мають власний викладацький простір. Власника даних
  // сторінки та дії визначають за id цієї сесії, а не за даними форми.
  return requireAppUser();
}
