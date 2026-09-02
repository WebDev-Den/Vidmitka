import { ScheduleCatalogPage } from "@/components/private/schedule-catalog-page";
import { listScheduleCatalog } from "@/lib/schedule-v2/catalogs";

import { manageScheduleCatalogAction } from "../catalog-actions";

export default async function TeachersPage() {
  return <ScheduleCatalogPage title="Викладачі" description="Викладачі, яких можна призначати до одного або кількох занять."
    entries={await listScheduleCatalog("teachers")} action={manageScheduleCatalogAction.bind(null, "teachers")}
    nameLabel="ПІБ викладача" addLabel="Додати викладача" />;
}
