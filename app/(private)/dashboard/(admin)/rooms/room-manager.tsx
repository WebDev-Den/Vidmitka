"use client";

import { DirectoryManager } from "@/components/private/directory-manager";
import type { Room } from "@/lib/rooms/repository";
import { createRoomAction, toggleRoomAction } from "./actions";

export function RoomManager({ rooms }: { rooms: Room[] }) {
  return <DirectoryManager entries={rooms} createAction={createRoomAction} toggleAction={toggleRoomAction}
    caption="Аудиторії" fieldLabel="Назва або номер аудиторії" addLabel="Додати аудиторію" maxLength={100} feminine
    emptyMessage="Аудиторій ще немає. Додайте першу аудиторію." />;
}
