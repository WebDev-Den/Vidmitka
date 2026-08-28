import { colorForeground, parseHexColor } from "@/lib/ui/colors";

export const DEFAULT_LESSON_TYPE_COLOR = "#0F766E";

export function lessonTypeAppearance(name: string | null, color: unknown) {
  const background = (name && parseHexColor(color)) || "#EFECE6";
  return {
    label: name || "Тип не вказано",
    background,
    foreground: colorForeground(background),
  };
}
