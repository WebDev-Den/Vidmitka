// Semantic colors for the bell timetable, using only the approved site palette.
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

export type PeriodColor = (typeof PERIOD_COLORS)[number]["value"];

export function parsePeriodColor(value: unknown): PeriodColor | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return PERIOD_COLORS.find((color) => color.value === normalized)?.value ?? null;
}

export function periodColorForeground(color: PeriodColor): string {
  return PERIOD_COLORS.find((entry) => entry.value === color)?.foreground ?? "#FFFFFF";
}
