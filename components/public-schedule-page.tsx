import { cookies } from "next/headers";

import { PublicScheduleExplorer } from "@/components/public-schedule-explorer";
import { getDateKeyInTimeZone } from "@/lib/schedule-week/rules";
import {
  getPublicScheduleDay,
  listPublicPeriods,
  listPublicTeachers,
} from "@/lib/schedule-v2/public-schedule";
import {
  isPublicUuid,
  normalizePublicTeacherPreference,
  PUBLIC_TEACHER_COOKIE,
} from "@/lib/schedule-v2/public-schedule-state";

export async function PublicSchedulePage() {
  const date = getDateKeyInTimeZone(new Date());
  const storedTeacherId = (await cookies()).get(PUBLIC_TEACHER_COOKIE)?.value;
  const requestedTeacherId = storedTeacherId && isPublicUuid(storedTeacherId) ? storedTeacherId : "";
  const [teachers, periods, day] = await Promise.all([
    listPublicTeachers(),
    listPublicPeriods(),
    getPublicScheduleDay({ date, groupId: null, teacherId: requestedTeacherId || null }),
  ]);
  const selectedTeacherId = normalizePublicTeacherPreference(requestedTeacherId, teachers);

  return <PublicScheduleExplorer
    periods={periods}
    initialDay={day}
    initialTeacherId={selectedTeacherId}
    teachers={teachers}
  />;
}
