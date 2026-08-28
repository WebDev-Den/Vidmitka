export type HexColor = `#${string}`;

export function parseHexColor(value: unknown): HexColor | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return /^#[0-9A-F]{6}$/u.test(normalized) ? normalized as HexColor : null;
}

function luminance(color: HexColor): number {
  const [red, green, blue] = [1, 3, 5].map((offset) => {
    const channel = Number.parseInt(color.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

/** A readable foreground for any opaque RGB background, including mid-tones. */
export function colorForeground(color: HexColor): string {
  const normalized = parseHexColor(color);
  if (!normalized) return "#18283D";
  const background = luminance(normalized);
  if (1.05 / (background + 0.05) >= 4.5) return "#FFFFFF";
  const inkContrast = (background + 0.05) / (luminance("#18283D") + 0.05);
  return inkContrast >= 4.5 ? "#18283D" : "#000000";
}
