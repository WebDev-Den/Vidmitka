import { lessonTypeAppearance } from "@/lib/lesson-types/colors";
import styles from "./lesson-type-badge.module.css";

export function LessonTypeBadge({ name, color }: { name: string | null; color: string | null }) {
  const appearance = lessonTypeAppearance(name, color);
  return <span className={styles.badge} style={{ backgroundColor: appearance.background, color: appearance.foreground }}>
    {appearance.label}
  </span>;
}
