export function shouldShowBaseOccurrence(input: {
  exceptionKind: string | null;
  selectedDate: string;
  newDate: string | null;
}): boolean {
  return !(["move", "reschedule"].includes(input.exceptionKind ?? "") &&
    input.newDate !== null && input.newDate !== input.selectedDate);
}
