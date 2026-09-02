import { ScheduleCatalogPage } from "@/components/private/schedule-catalog-page";
import { listScheduleCatalog } from "@/lib/schedule-v2/catalogs";

import { manageScheduleCatalogAction } from "../catalog-actions";

export default async function GroupsPage() {
  return <ScheduleCatalogPage title="Групи" description="Коди академічних груп, що використовуються у розкладі."
    entries={await listScheduleCatalog("groups")} action={manageScheduleCatalogAction.bind(null, "groups")}
    nameLabel="Код групи" addLabel="Додати групу" />;
}
