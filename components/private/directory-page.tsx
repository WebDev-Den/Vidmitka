import { Plus, type LucideIcon } from "lucide-react";

import { PageIntro } from "@/components/page-intro";
import { EmptyState } from "@/components/private/empty-state";

export function DirectoryPage({
  eyebrow,
  title,
  description,
  emptyTitle,
  emptyDescription,
  icon,
  createLabel,
}: {
  eyebrow: string;
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
  icon: LucideIcon;
  createLabel: string;
}) {
  return (
    <section>
      <PageIntro
        eyebrow={eyebrow}
        title={title}
        description={description}
        actions={
          <button className="button button-primary" type="button" disabled>
            <Plus size={17} />
            {createLabel}
          </button>
        }
      />
      <EmptyState
        icon={icon}
        title={emptyTitle}
        description={emptyDescription}
      />
    </section>
  );
}
