import { colorForeground, parseHexColor, type HexColor } from "@/lib/ui/colors";

// Default bell-timetable colors. Administrators may also choose any opaque RGB color.
export const PERIOD_COLORS = [
  { value: "#0F766E", name: "Бірюзовий", foreground: "#FFFFFF" },
  { value: "#48C5B5", name: "М’ятний", foreground: "#18283D" },
  { value: "#16835B", name: "Зелений", foreground: "#FFFFFF" },
  { value: "#DED9CD", name: "Пісочний", foreground: "#18283D" },
  { value: "#073C40", name: "Темний бірюзовий", foreground: "#FFFFFF" },
  { value: "#EFECE6", name: "Теплий світлий", foreground: "#18283D" },
  { value: "#243B3A", name: "Графітово-зелений", foreground: "#FFFFFF" },
  { value: "#18283D", name: "Чорнильний", foreground: "#FFFFFF" },
] as const;

export type PeriodColor = HexColor;

export function parsePeriodColor(value: unknown): PeriodColor | null {
  return parseHexColor(value);
}

export function periodColorForeground(color: PeriodColor): string {
  const normalized = parsePeriodColor(color);
  if (!normalized) return "#18283D";
  const preset = PERIOD_COLORS.find((entry) => entry.value === normalized);
  if (preset) return preset.foreground;

  return colorForeground(normalized);
}
