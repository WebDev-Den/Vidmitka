import { PrivateShell } from "@/components/private-shell";
import { requireAdminPanelUser } from "@/lib/auth/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const administrator = await requireAdminPanelUser();
  return <PrivateShell user={administrator}>{children}</PrivateShell>;
}
