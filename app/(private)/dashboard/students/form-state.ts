export type StudentActionState = Readonly<{ success: boolean; message: string }>;
export const initialStudentActionState: StudentActionState = { success: false, message: "" };
