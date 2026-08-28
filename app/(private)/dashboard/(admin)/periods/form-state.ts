export type PeriodActionState = Readonly<{
  success: boolean;
  message: string;
  submittedAt: number;
}>;

export const initialPeriodActionState: PeriodActionState = {
  success: false,
  message: "",
  submittedAt: 0,
};
