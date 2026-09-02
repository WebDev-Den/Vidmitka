import { PageIntro } from "@/components/page-intro";
import { ScheduleCatalogManager } from "@/components/private/schedule-catalog-manager";
import type { CatalogMutationResult, ScheduleCatalogEntry } from "@/lib/schedule-v2/catalog-types";

export function ScheduleCatalogPage(props: {
  eyebrow?: string;
  title: string;
  description: string;
  entries: readonly ScheduleCatalogEntry[];
  action: (previousState: CatalogMutationResult, formData: FormData) => Promise<CatalogMutationResult>;
  nameLabel: string;
  addLabel: string;
  withColor?: boolean;
}) {
  return <section className="management-page">
    <PageIntro eyebrow={props.eyebrow ?? "ДОВІДНИКИ"} title={props.title} description={props.description} />
    <ScheduleCatalogManager entries={props.entries} action={props.action} caption={props.title}
      nameLabel={props.nameLabel} addLabel={props.addLabel} withColor={props.withColor} />
  </section>;
}
