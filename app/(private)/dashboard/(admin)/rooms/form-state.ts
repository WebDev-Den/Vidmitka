export type RoomActionState = Readonly<{
  success: boolean;
  message: string;
}>;

export const initialRoomActionState: RoomActionState = {
  success: false,
  message: "",
};
