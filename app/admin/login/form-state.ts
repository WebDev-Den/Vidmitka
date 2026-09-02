import type { AuthFieldErrors } from "@/lib/auth/validation";

export type AdminAuthActionState = Readonly<{
  success: boolean;
  message: string;
  fieldErrors: AuthFieldErrors;
  values: Readonly<{ email?: string }>;
}>;
export const initialAdminAuthActionState: AdminAuthActionState = { success: false, message: "", fieldErrors: {}, values: {} };
