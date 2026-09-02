import { ScheduleCatalogPage } from "@/components/private/schedule-catalog-page";
import { listScheduleCatalog } from "@/lib/schedule-v2/catalogs";

import { manageScheduleCatalogAction } from "../catalog-actions";

export default async function LessonTypesPage() {
  return <ScheduleCatalogPage title="Типи занять" description="Керуйте назвами й кольорами типів занять. Колір використовується у розкладі."
    entries={await listScheduleCatalog("lesson-types")} action={manageScheduleCatalogAction.bind(null, "lesson-types")}
    nameLabel="Назва типу" addLabel="Додати тип" withColor />;
}
