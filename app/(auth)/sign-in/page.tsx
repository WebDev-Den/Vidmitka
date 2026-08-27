import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getOptionalAppUser } from "@/lib/auth/session";

import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Вхід" };

export default async function SignInPage() {
  const user = await getOptionalAppUser();
  if (user) {
    redirect(user.approval === "approved" ? "/dashboard" : "/approval-pending");
  }

  return <SignInForm />;
}
