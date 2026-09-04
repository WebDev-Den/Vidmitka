export type CronActionState = Readonly<{
  success: boolean;
  message: string;
  submittedAt: number;
}>;

export const initialCronActionState: CronActionState = {
  success: false,
  message: "",
  submittedAt: 0,
};
