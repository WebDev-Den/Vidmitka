import { CalendarPlus, Plus } from "lucide-react";
import Link from "next/link";

import { PageIntro } from "@/components/page-intro";
import { EmptyState } from "@/components/private/empty-state";

export default function MyLessonsPage() {
  return (
    <section>
      <PageIntro
        eyebrow="КАБІНЕТ ВИКЛАДАЧА"
        title="Мої заняття"
        description="Створені вами заняття та їхній поточний стан."
        actions={
          <Link className="button button-primary" href="/dashboard/lessons/new">
            <Plus size={17} /> Створити заняття
          </Link>
        }
      />
      <EmptyState
        icon={CalendarPlus}
        title="Занять ще немає"
        description="Після створення заняття ви зможете редагувати або видалити його тут."
      />
    </section>
  );
}
