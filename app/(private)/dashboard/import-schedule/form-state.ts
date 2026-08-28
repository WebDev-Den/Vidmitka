export type ImportScheduleActionState = Readonly<{
  success: boolean;
  message: string;
  errors: string[];
  importedCount: number;
}>;

export const initialImportScheduleActionState: ImportScheduleActionState = {
  success: false,
  message: "",
  errors: [],
  importedCount: 0,
};
