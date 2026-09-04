import type { HexColor } from "@/lib/ui/colors";

export type ScheduleCatalogKind = "groups" | "disciplines" | "rooms" | "teachers" | "lesson-types";

export type ScheduleCatalogEntry = Readonly<{
  id: string;
  name: string;
  isActive: boolean;
  color?: HexColor;
}>;

export type CatalogMutationResult = Readonly<{ success: boolean; message: string; id?: string }>;
