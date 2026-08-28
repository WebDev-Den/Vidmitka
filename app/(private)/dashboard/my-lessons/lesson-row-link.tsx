"use client";

import { Copy, Users } from "lucide-react";
import Link, { useLinkStatus } from "next/link";
import styles from "./my-lessons.module.css";

function RowLinkContent({ kind }: { kind: "copy" | "students" }) {
  const { pending } = useLinkStatus();
  const Icon = kind === "copy" ? Copy : Users;
  const label = kind === "copy" ? "Копіювати" : "Студенти";
  return <>
    {pending ? <span className="navigation-spinner" aria-hidden="true" /> : <Icon size={15} aria-hidden="true" />}
    {label}
    <span className="sr-only" role="status">{pending ? "Завантаження форми…" : ""}</span>
  </>;
}

export function LessonRowLink({ lessonId, subjectName, kind }: { lessonId: string; subjectName: string; kind: "copy" | "students" }) {
  return <Link className={styles.rowAction}
    href={kind === "copy" ? `/dashboard/lessons/new?copy=${encodeURIComponent(lessonId)}` : `/dashboard/my-lessons/${lessonId}/students`}
    aria-label={`${kind === "copy" ? "Копіювати заняття" : "Додати студентів до заняття"}: ${subjectName}`}>
    <RowLinkContent kind={kind} />
  </Link>;
}
