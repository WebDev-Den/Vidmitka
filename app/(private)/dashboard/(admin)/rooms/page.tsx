import { Building2 } from "lucide-react";

import { DirectoryPage } from "@/components/private/directory-page";

export default function RoomsPage() {
  return (
    <DirectoryPage
      eyebrow="ДОВІДНИКИ"
      title="Аудиторії"
      description="Перелік доступних приміщень для перевірки зайнятості."
      emptyTitle="Аудиторій ще немає"
      emptyDescription="Додайте аудиторії, перш ніж створювати навчальні заняття."
      icon={Building2}
      createLabel="Додати аудиторію"
    />
  );
}
