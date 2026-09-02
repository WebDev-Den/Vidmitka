import { ScheduleCatalogPage } from "@/components/private/schedule-catalog-page";
import { listScheduleCatalog } from "@/lib/schedule-v2/catalogs";

import { manageScheduleCatalogAction } from "../catalog-actions";

export default async function DisciplinesPage() {
  return <ScheduleCatalogPage title="Дисципліни" description="Навчальні дисципліни для повторюваного й разового розкладу."
    entries={await listScheduleCatalog("disciplines")} action={manageScheduleCatalogAction.bind(null, "disciplines")}
    nameLabel="Назва дисципліни" addLabel="Додати дисципліну" />;
}
