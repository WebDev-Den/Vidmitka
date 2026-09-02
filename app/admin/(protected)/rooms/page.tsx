import { ScheduleCatalogPage } from "@/components/private/schedule-catalog-page";
import { listScheduleCatalog } from "@/lib/schedule-v2/catalogs";

import { manageScheduleCatalogAction } from "../catalog-actions";

export default async function RoomsPage() {
  return <ScheduleCatalogPage title="Аудиторії" description="Фізичні аудиторії та позначення дистанційних занять."
    entries={await listScheduleCatalog("rooms")} action={manageScheduleCatalogAction.bind(null, "rooms")}
    nameLabel="Назва аудиторії" addLabel="Додати аудиторію" />;
}
