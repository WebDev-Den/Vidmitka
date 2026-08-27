export type WeekSettingsActionState = Readonly<{
  success: boolean;
  message: string;
}>;

export const initialWeekSettingsActionState: WeekSettingsActionState = {
  success: false,
  message: "",
};

export type SemesterEndActionState = Readonly<{
  success: boolean;
  message: string;
}>;

export const initialSemesterEndActionState: SemesterEndActionState = {
  success: false,
  message: "",
};
