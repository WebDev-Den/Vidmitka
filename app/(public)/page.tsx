import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PublicSchedulePage } from "@/components/public-schedule-page";

export const metadata: Metadata = { title: "Публічний розклад" };

export default async function PublicHomePage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  if (Object.keys(params).length) redirect("/");
  return <PublicSchedulePage />;
}
