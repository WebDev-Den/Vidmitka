export type AdminPushActionState = Readonly<{ success: boolean; message: string }>;

export const initialAdminPushActionState: AdminPushActionState = { success: false, message: "" };
