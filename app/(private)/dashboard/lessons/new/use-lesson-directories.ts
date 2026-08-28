"use client";

import { useRef, useState, useTransition } from "react";
import { mergeDirectoryOptions, type DirectoryCreateResult, type DirectoryOption, type LessonDirectoryKind } from "@/lib/lessons/directory-options";
import { createLessonDirectoryOption } from "./directory-actions";

type DirectoryOptions = Record<LessonDirectoryKind, readonly DirectoryOption[]>;

export function useLessonDirectories(initialOptions: DirectoryOptions) {
  const [created, setCreated] = useState<DirectoryOptions>({ subject: [], room: [], lessonType: [] });
  const [values, setValues] = useState({ subject: "", room: "", lessonType: "" });
  const [results, setResults] = useState<Record<LessonDirectoryKind, DirectoryCreateResult | null>>({ subject: null, room: null, lessonType: null });
  const [creatingKind, setCreatingKind] = useState<LessonDirectoryKind | null>(null);
  const [isCreating, startTransition] = useTransition();
  const inFlight = useRef(false);
  const options = {
    subject: mergeDirectoryOptions(initialOptions.subject, created.subject),
    room: mergeDirectoryOptions(initialOptions.room, created.room),
    lessonType: mergeDirectoryOptions(initialOptions.lessonType, created.lessonType),
  };

  function select(kind: LessonDirectoryKind, id: string) {
    setValues((current) => ({ ...current, [kind]: id }));
    setResults((current) => ({ ...current, [kind]: null }));
  }

  function create(kind: LessonDirectoryKind, name: string) {
    if (inFlight.current) return;
    inFlight.current = true;
    setCreatingKind(kind);
    setResults((current) => ({ ...current, [kind]: null }));
    startTransition(async () => {
      try {
        const result = await createLessonDirectoryOption(kind, name);
        if (result.success) {
          setCreated((current) => ({ ...current, [kind]: mergeDirectoryOptions(current[kind], [result.option]) }));
          setValues((current) => ({ ...current, [kind]: result.option.id }));
        }
        setResults((current) => ({ ...current, [kind]: result }));
      } catch {
        setResults((current) => ({ ...current, [kind]: {
          success: false,
          message: "Зв’язок перервано. Перевірте довідник перед повторним додаванням. Заповнене заняття залишається у формі.",
        } }));
      } finally {
        inFlight.current = false;
        setCreatingKind(null);
      }
    });
  }

  return { options, values, results, creatingKind, isCreating, select, create };
}
