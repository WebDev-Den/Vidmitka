import { requireAdministrator } from "@/lib/auth/session";

export default async function AdministratorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdministrator();
  return children;
}
