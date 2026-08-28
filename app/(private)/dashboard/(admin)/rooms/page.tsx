import { PageIntro } from "@/components/page-intro";
import { listRooms } from "@/lib/rooms/repository";

import { RoomManager } from "./room-manager";

export default async function RoomsPage() {
  const rooms = await listRooms();

  return (
    <section className="management-page">
      <PageIntro
        eyebrow="ДОВІДНИКИ"
        title="Аудиторії"
        description="Активні аудиторії доступні для створення та імпорту навчальних занять."
      />
      <RoomManager rooms={rooms} />
    </section>
  );
}
