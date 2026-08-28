export type SubjectActionState = Readonly<{
  success: boolean;
  message: string;
}>;

export const initialSubjectActionState: SubjectActionState = {
  success: false,
  message: "",
};
