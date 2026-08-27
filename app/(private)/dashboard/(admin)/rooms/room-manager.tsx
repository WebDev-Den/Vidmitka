"use client";

import { Building2, Check, PauseCircle, Plus } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";

import type { Room } from "@/lib/rooms/repository";

import {
  createRoomAction,
  initialRoomActionState,
  toggleRoomAction,
} from "./actions";

export function RoomManager({ rooms }: { rooms: Room[] }) {
  const [state, formAction, pending] = useActionState(
    createRoomAction,
    initialRoomActionState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success, state.message]);

  return (
    <div className="subject-manager">
      <form ref={formRef} action={formAction} className="subject-create-form">
        <label>
          Назва або номер аудиторії
          <input name="name" type="text" maxLength={100} required />
        </label>
        <button className="button button-primary" type="submit" disabled={pending}>
          <Plus size={17} />
          {pending ? "Додавання…" : "Додати аудиторію"}
        </button>
        {state.message ? (
          <p
            className={`period-action-message${state.success ? " is-success" : " is-error"}`}
            role={state.success ? "status" : "alert"}
          >
            {state.message}
          </p>
        ) : null}
      </form>

      <div className="subject-list">
        {rooms.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state-icon"><Building2 size={22} /></span>
            <h2>Аудиторій ще немає</h2>
            <p>Додайте аудиторії, які викладачі зможуть використовувати під час імпорту.</p>
          </div>
        ) : (
          rooms.map((room) => {
            const toggleAction = toggleRoomAction.bind(null, room.id, !room.isActive);

            return (
              <div className="subject-row" key={room.id}>
                <div>
                  <strong>{room.name}</strong>
                  <span>{room.isActive ? "Активна" : "Неактивна"}</span>
                </div>
                <form action={toggleAction}>
                  <button className="button button-light" type="submit">
                    {room.isActive ? <PauseCircle size={16} /> : <Check size={16} />}
                    {room.isActive ? "Деактивувати" : "Активувати"}
                  </button>
                </form>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
