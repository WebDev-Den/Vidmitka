import "server-only";

import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { cache } from "react";

import {
  getRoleLabel,
  resolveAccountAccess,
  type AccountApproval,
  type AppRole,
} from "./roles";

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

export const getAuthenticatedAppUser = cache(async (): Promise<AppUser> => {
  const { userId } = await auth();

  if (!userId) redirect("/sign-in");

  const user = await currentUser();
  const primaryEmail = user?.emailAddresses.find(
    (email) => email.id === user.primaryEmailAddressId,
  )?.emailAddress;

  if (!user || !primaryEmail) redirect("/sign-in?reason=email-required");

  const name =
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
    primaryEmail.split("@")[0];
  const access = resolveAccountAccess(
    primaryEmail,
    user.privateMetadata.approved,
  );

  return {
    id: user.id,
    email: primaryEmail,
    name,
    initials: getInitials(name, primaryEmail),
    role: access.role,
    roleLabel: getRoleLabel(access.role),
    approval: access.approval,
  };
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
