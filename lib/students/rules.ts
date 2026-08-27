export type StudentAssignmentDraft = Readonly<{
  fullName: string;
  groupName: string;
  subjectId: string;
}>;

export type StudentAssignmentValidation =
  | Readonly<{ ok: true; value: StudentAssignmentDraft }>
  | Readonly<{ ok: false; message: string }>;

function normalizedText(value: FormDataEntryValue | null): string {
  return typeof value === "string"
    ? value.trim().replace(/\s+/gu, " ")
    : "";
}

export function validateStudentAssignment(input: {
  fullName: FormDataEntryValue | null;
  groupName: FormDataEntryValue | null;
  subjectId: FormDataEntryValue | null;
}): StudentAssignmentValidation {
  const fullName = normalizedText(input.fullName);
  const groupName = normalizedText(input.groupName);
  const subjectId = normalizedText(input.subjectId);

  if (fullName.length < 3 || fullName.length > 200) {
    return { ok: false, message: "Вкажіть повне ПІБ студента." };
  }

  if (groupName.length < 2 || groupName.length > 100) {
    return { ok: false, message: "Вкажіть навчальну групу студента." };
  }

  if (!/^\d+$/u.test(subjectId)) {
    return { ok: false, message: "Оберіть навчальний предмет." };
  }

  return { ok: true, value: { fullName, groupName, subjectId } };
}
