import { PrivateShell } from "@/components/private-shell";
import { requireAppUser } from "@/lib/auth/session";

export default async function PrivateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAppUser();

  return <PrivateShell user={user}>{children}</PrivateShell>;
}
