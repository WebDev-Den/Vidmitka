export type JournalActionState = { success: boolean; message: string };
export const initialJournalState: JournalActionState = { success: false, message: "" };
export type StudentImportState = JournalActionState & { errors: string[] };
export const initialStudentImportState: StudentImportState = { ...initialJournalState, errors: [] };
