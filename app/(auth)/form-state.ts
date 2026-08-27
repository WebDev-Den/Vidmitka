import type { AuthFieldErrors } from "@/lib/auth/validation";

export type AuthActionState = Readonly<{
  success: boolean;
  message: string;
  fieldErrors: AuthFieldErrors;
  values: Readonly<{ fullName?: string; email?: string }>;
}>;

export const initialAuthActionState: AuthActionState = {
  success: false,
  message: "",
  fieldErrors: {},
  values: {},
};
