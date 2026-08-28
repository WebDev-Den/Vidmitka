"use client";

import { DirectoryManager } from "@/components/private/directory-manager";
import type { Subject } from "@/lib/subjects/repository";
import { createSubjectAction, toggleSubjectAction } from "./actions";

export function SubjectManager({ subjects }: { subjects: Subject[] }) {
  return <DirectoryManager entries={subjects} createAction={createSubjectAction} toggleAction={toggleSubjectAction}
    caption="Навчальні предмети" fieldLabel="Назва навчального предмета" addLabel="Додати предмет" maxLength={200}
    emptyMessage="Предметів ще немає. Додайте перший предмет." />;
}
