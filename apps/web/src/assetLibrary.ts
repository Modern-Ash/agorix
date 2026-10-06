/**
 * Built-in, offline asset library (issue #297).
 *
 * Every asset is code-native (an emoji glyph or SVG shapes drawn by StageView), so nothing is
 * fetched and no file has to be bundled. Projects store only the asset `id`; metadata here is
 * display-only. To add an asset: append an entry below with a unique lowercase-kebab id
 * (matching /^[a-z][a-z0-9-]{0,31}$/), then add its look in StageView (backdrops) or just its
 * glyph (actor visuals). Never reuse or rename an id: saved projects refer to it.
 */
export type AssetKind = "actor" | "backdrop" | "sound";

export interface LibraryAsset {
  readonly id: string;
  readonly kind: AssetKind;
  /** Localized display names. */
  readonly name: { readonly en: string; readonly es: string };
  /** Natural size in stage units. */
  readonly width: number;
  readonly height: number;
  readonly tags: readonly string[];
  /** Actor visuals: the glyph drawn on the stage. */
  readonly glyph?: string;
  /** Sounds: a synthesized tone, so no audio file is bundled. */
  readonly tone?: { readonly hz: number; readonly ms: number };
}

export const ACTOR_VISUALS: readonly LibraryAsset[] = [
  {
    id: "rocket",
    kind: "actor",
    name: { en: "Rocket", es: "Cohete" },
    width: 24,
    height: 24,
    tags: ["space", "vehicle"],
    glyph: "🚀",
  },
  {
    id: "cat",
    kind: "actor",
    name: { en: "Cat", es: "Gato" },
    width: 24,
    height: 24,
    tags: ["animal"],
    glyph: "🐱",
  },
  {
    id: "ball",
    kind: "actor",
    name: { en: "Ball", es: "Pelota" },
    width: 24,
    height: 24,
    tags: ["sport", "object"],
    glyph: "⚽",
  },
  {
    id: "robot",
    kind: "actor",
    name: { en: "Robot", es: "Robot" },
    width: 24,
    height: 24,
    tags: ["machine"],
    glyph: "🤖",
  },
];

export const BACKDROPS: readonly LibraryAsset[] = [
  {
    id: "sky",
    kind: "backdrop",
    name: { en: "Sky", es: "Cielo" },
    width: 264,
    height: 192,
    tags: ["outdoor"],
  },
  {
    id: "space",
    kind: "backdrop",
    name: { en: "Space", es: "Espacio" },
    width: 264,
    height: 192,
    tags: ["space", "dark"],
  },
  {
    id: "meadow",
    kind: "backdrop",
    name: { en: "Meadow", es: "Pradera" },
    width: 264,
    height: 192,
    tags: ["outdoor", "nature"],
  },
  {
    id: "grid",
    kind: "backdrop",
    name: { en: "Graph paper", es: "Papel cuadriculado" },
    width: 264,
    height: 192,
    tags: ["plain", "math"],
  },
];

export const SOUNDS: readonly LibraryAsset[] = [
  {
    id: "pop",
    kind: "sound",
    name: { en: "Pop", es: "Pop" },
    width: 0,
    height: 0,
    tags: ["short"],
    tone: { hz: 520, ms: 120 },
  },
  {
    id: "beep",
    kind: "sound",
    name: { en: "Beep", es: "Bip" },
    width: 0,
    height: 0,
    tags: ["machine"],
    tone: { hz: 880, ms: 220 },
  },
  {
    id: "chime",
    kind: "sound",
    name: { en: "Chime", es: "Campanilla" },
    width: 0,
    height: 0,
    tags: ["reward"],
    tone: { hz: 1320, ms: 380 },
  },
];

export function findActorVisual(id: string | undefined): LibraryAsset | undefined {
  return ACTOR_VISUALS.find((asset) => asset.id === id);
}

export function findBackdrop(id: string | undefined): LibraryAsset | undefined {
  return BACKDROPS.find((asset) => asset.id === id);
}

export function assetName(asset: LibraryAsset, locale: "en" | "es"): string {
  return asset.name[locale];
}
