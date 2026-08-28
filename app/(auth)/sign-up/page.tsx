import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getOptionalAppUser } from "@/lib/auth/session";
import { isAdministratorRegistrationOpen } from "@/lib/auth/repository";

import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = { title: "Реєстрація" };

export default async function SignUpPage() {
  const user = await getOptionalAppUser();
  if (user) {
    redirect(user.approval === "approved" ? "/dashboard" : "/approval-pending");
  }

  return <SignUpForm showAdministratorCode={await isAdministratorRegistrationOpen()} />;
}
