import type { KidsWorld } from "./kidsState.js";

/** Look of each Kids world (from the prototype's WORLDS table). Art only: no program semantics. */
export interface KidsWorldStyle {
  readonly bg: string;
  readonly cell: string;
  readonly trail: string;
  readonly goal: string;
  readonly sprite: string;
  readonly ink: string;
  readonly tint: string;
  /** Default character glyph for the world and its goal glyph. */
  readonly character: string;
  readonly goalGlyph: string;
}

export const KIDS_WORLD_STYLES: Readonly<Record<KidsWorld, KidsWorldStyle>> = {
  space: {
    bg: "#1e1b4b",
    cell: "rgba(165,180,252,.22)",
    trail: "#a5b4fc",
    goal: "#fde68a",
    sprite: "#818cf8",
    ink: "#3730a3",
    tint: "#EEF0FF",
    character: "🚀",
    goalGlyph: "🌎",
  },
  ocean: {
    bg: "#b6e3f4",
    cell: "rgba(43,122,155,.22)",
    trail: "#2b7a9b",
    goal: "#ff9e80",
    sprite: "#1d6fa5",
    ink: "#0b5d8a",
    tint: "#E6F5FB",
    character: "🐙",
    goalGlyph: "🪸",
  },
  robots: {
    bg: "#e4e7eb",
    cell: "rgba(107,114,128,.22)",
    trail: "#6b7280",
    goal: "#fcd34d",
    sprite: "#64748b",
    ink: "#374151",
    tint: "#F1F2F4",
    character: "🤖",
    goalGlyph: "🔋",
  },
  city: {
    bg: "#fde8c8",
    cell: "rgba(146,64,14,.16)",
    trail: "#92400e",
    goal: "#86efac",
    sprite: "#f97316",
    ink: "#9a3412",
    tint: "#FFF4E6",
    character: "🛴",
    goalGlyph: "📦",
  },
};
