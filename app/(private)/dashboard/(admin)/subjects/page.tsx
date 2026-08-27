import { BookOpen } from "lucide-react";

import { DirectoryPage } from "@/components/private/directory-page";

export default function SubjectsPage() {
  return (
    <DirectoryPage
      eyebrow="ДОВІДНИКИ"
      title="Навчальні предмети"
      description="Назви предметів, які можна використовувати під час створення занять."
      emptyTitle="Предметів ще немає"
      emptyDescription="Додайте перший предмет, щоб викладачі могли створювати заняття."
      icon={BookOpen}
      createLabel="Додати предмет"
    />
  );
}
