"use server";

import { redirect } from "next/navigation";

import { endAppSession } from "@/lib/auth/session";

export async function adminSignOutAction(): Promise<void> {
  await endAppSession();
  redirect("/");
}
