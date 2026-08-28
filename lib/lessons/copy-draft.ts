import type { LessonWeekType } from "@/lib/schedule-week/rules";

export type LessonFormDefaults = {
  teacherId: string;
  subjectId: string;
  roomId: string;
  classPeriodId: string;
  lessonTypeId: string;
  dayOfWeek: number;
  weekType: LessonWeekType;
  studentIds: string[];
};

export type LessonCopySource = Omit<LessonFormDefaults, "lessonTypeId"> & {
  id: string;
  subjectName: string;
  lessonTypeId: string | null;
  rosterMode: "subject" | "selected";
};

type Choice = { id: string };
export function prepareLessonCopy(source: LessonCopySource, available: {
  teachers: readonly Choice[]; subjects: readonly Choice[]; rooms: readonly Choice[];
  periods: readonly Choice[]; lessonTypes: readonly Choice[]; students: readonly Choice[];
}) {
  const unavailableFields: string[] = [];
  function choose(id: string | null, options: readonly Choice[], label: string) {
    if (id && options.some((option) => option.id === id)) return id;
    unavailableFields.push(label);
    return "";
  }
  const activeStudents = new Set(available.students.map((student) => student.id));
  const studentIds = [...new Set(source.studentIds)].filter((id) => activeStudents.has(id));
  const defaults: LessonFormDefaults = {
    teacherId: choose(source.teacherId, available.teachers, "викладач"),
    subjectId: choose(source.subjectId, available.subjects, "предмет"),
    roomId: choose(source.roomId, available.rooms, "аудиторія"),
    classPeriodId: choose(source.classPeriodId, available.periods, "пара"),
    lessonTypeId: choose(source.lessonTypeId, available.lessonTypes, "тип заняття"),
    dayOfWeek: source.dayOfWeek,
    weekType: source.weekType,
    studentIds,
  };
  return { defaults, unavailableFields, omittedStudentCount: new Set(source.studentIds).size - studentIds.length };
}
