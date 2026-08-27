"use server";

import { revalidatePath } from "next/cache";

import { requireAdministrator } from "@/lib/auth/session";
import { createRoom, setRoomActive } from "@/lib/rooms/repository";

export type RoomActionState = Readonly<{
  success: boolean;
  message: string;
}>;

export const initialRoomActionState: RoomActionState = {
  success: false,
  message: "",
};

export async function createRoomAction(
  _previousState: RoomActionState,
  formData: FormData,
): Promise<RoomActionState> {
  await requireAdministrator();
  const result = await createRoom(formData.get("name"));

  if (result.success) {
    revalidatePath("/dashboard/rooms");
    revalidatePath("/dashboard/schedule/import");
    revalidatePath("/dashboard/lessons/new");
  }

  return result;
}

export async function toggleRoomAction(id: string, isActive: boolean): Promise<void> {
  await requireAdministrator();
  await setRoomActive(id, isActive);
  revalidatePath("/dashboard/rooms");
  revalidatePath("/dashboard/schedule/import");
  revalidatePath("/dashboard/lessons/new");
}
