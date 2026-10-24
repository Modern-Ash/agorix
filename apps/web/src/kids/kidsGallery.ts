import type { Locale } from "../i18n.js";

export const KIDS_GALLERY_CHARACTERS = [
  { id: "nova", category: "space", es: "Nova", en: "Nova", glyph: "🤖", color: "#dce9ff" },
  { id: "luma", category: "space", es: "Luma", en: "Luma", glyph: "⭐", color: "#fff0ad" },
  { id: "comet", category: "space", es: "Cometa", en: "Comet", glyph: "🚀", color: "#ffd5c4" },
  { id: "mika", category: "animals", es: "Mika", en: "Mika", glyph: "🐱", color: "#ffdfd3" },
  { id: "pip", category: "animals", es: "Pip", en: "Pip", glyph: "🐦", color: "#d4f2f1" },
  { id: "tito", category: "animals", es: "Tito", en: "Tito", glyph: "🐢", color: "#dff3c3" },
  { id: "nori", category: "sea", es: "Nori", en: "Nori", glyph: "🐙", color: "#dfd5ff" },
  { id: "reef", category: "sea", es: "Arrecife", en: "Reef", glyph: "🐠", color: "#cef0ff" },
  { id: "blossom", category: "nature", es: "Flor", en: "Blossom", glyph: "🌼", color: "#ffe5c6" },
  {
    id: "mushroom",
    category: "nature",
    es: "Hongo",
    en: "Mushroom",
    glyph: "🍄",
    color: "#ffdfdd",
  },
  { id: "bolt", category: "fantasy", es: "Rayo", en: "Bolt", glyph: "⚡", color: "#fff3b8" },
  { id: "pixel", category: "fantasy", es: "Pixel", en: "Pixel", glyph: "👾", color: "#e4d5ff" },
] as const;

export const KIDS_GALLERY_BACKDROPS = [
  {
    id: "forest",
    category: "nature",
    es: "Bosque",
    en: "Forest",
    sky: "#b7e9d0",
    ground: "#5ea879",
    glyph: "🌲",
  },
  {
    id: "garden",
    category: "nature",
    es: "Jardín",
    en: "Garden",
    sky: "#ffe5be",
    ground: "#85c78a",
    glyph: "🌷",
  },
  {
    id: "mountain",
    category: "nature",
    es: "Montañas",
    en: "Mountains",
    sky: "#b8d9f2",
    ground: "#7ba3ad",
    glyph: "🏔️",
  },
  {
    id: "beach",
    category: "sea",
    es: "Playa",
    en: "Beach",
    sky: "#a3e5ef",
    ground: "#f2d393",
    glyph: "🏖️",
  },
  {
    id: "reef",
    category: "sea",
    es: "Arrecife",
    en: "Reef",
    sky: "#7ccddb",
    ground: "#187b9a",
    glyph: "🪸",
  },
  {
    id: "moon",
    category: "space",
    es: "Luna",
    en: "Moon",
    sky: "#333e77",
    ground: "#a5afc9",
    glyph: "🌙",
  },
  {
    id: "galaxy",
    category: "space",
    es: "Galaxia",
    en: "Galaxy",
    sky: "#453b86",
    ground: "#765ea7",
    glyph: "🪐",
  },
  {
    id: "lab",
    category: "fantasy",
    es: "Laboratorio",
    en: "Lab",
    sky: "#cfedf2",
    ground: "#7ca2b5",
    glyph: "🧪",
  },
  {
    id: "castle",
    category: "fantasy",
    es: "Castillo",
    en: "Castle",
    sky: "#dfd3f4",
    ground: "#9d83ba",
    glyph: "🏰",
  },
] as const;

export type KidsGalleryCharacterId = (typeof KIDS_GALLERY_CHARACTERS)[number]["id"];
export type KidsGalleryBackdropId = (typeof KIDS_GALLERY_BACKDROPS)[number]["id"];
export type KidsGalleryCategory = "all" | "animals" | "nature" | "sea" | "space" | "fantasy";

export const KIDS_GALLERY_CATEGORIES: readonly KidsGalleryCategory[] = [
  "all",
  "animals",
  "nature",
  "sea",
  "space",
  "fantasy",
];

export function galleryCategoryName(category: KidsGalleryCategory, locale: Locale): string {
  const names = {
    all: ["Todos", "All"],
    animals: ["Animales", "Animals"],
    nature: ["Naturaleza", "Nature"],
    sea: ["Mar", "Sea"],
    space: ["Espacio", "Space"],
    fantasy: ["Fantasía", "Fantasy"],
  } as const;
  return names[category][locale === "es" ? 0 : 1];
}

export function isGalleryCharacterId(value: unknown): value is KidsGalleryCharacterId {
  return typeof value === "string" && KIDS_GALLERY_CHARACTERS.some((item) => item.id === value);
}

export function isGalleryBackdropId(value: unknown): value is KidsGalleryBackdropId {
  return typeof value === "string" && KIDS_GALLERY_BACKDROPS.some((item) => item.id === value);
}

export function galleryCharacterName(id: KidsGalleryCharacterId, locale: Locale): string {
  const item = KIDS_GALLERY_CHARACTERS.find((entry) => entry.id === id)!;
  return locale === "es" ? item.es : item.en;
}

export function galleryBackdropName(id: KidsGalleryBackdropId, locale: Locale): string {
  const item = KIDS_GALLERY_BACKDROPS.find((entry) => entry.id === id)!;
  return locale === "es" ? item.es : item.en;
}

function svgUrl(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Bundled art is generated from a fixed catalog; project files persist only the allowlisted id. */
export function galleryCharacterArt(id: KidsGalleryCharacterId): string {
  const item = KIDS_GALLERY_CHARACTERS.find((entry) => entry.id === id)!;
  return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
    <circle cx="60" cy="60" r="55" fill="${item.color}"/>
    <circle cx="60" cy="60" r="49" fill="none" stroke="#35405b" stroke-opacity=".2" stroke-width="2"/>
    <circle cx="24" cy="30" r="4" fill="#fff" opacity=".8"/>
    <circle cx="95" cy="84" r="5" fill="#fff" opacity=".8"/>
    <text x="60" y="83" text-anchor="middle" font-size="67" font-family="sans-serif">${item.glyph}</text>
  </svg>`);
}

export function galleryBackdropArt(id: KidsGalleryBackdropId): string {
  const item = KIDS_GALLERY_BACKDROPS.find((entry) => entry.id === id)!;
  return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice">
    <rect width="400" height="260" fill="${item.sky}"/>
    <circle cx="320" cy="58" r="28" fill="#fff7cc" opacity=".85"/>
    <path d="M0 175 Q90 125 180 175 T400 165 V260 H0Z" fill="${item.ground}"/>
    <path d="M0 210 Q110 175 220 210 T400 190 V260 H0Z" fill="#244b65" opacity=".16"/>
    <text x="200" y="168" text-anchor="middle" font-size="100" font-family="sans-serif">${item.glyph}</text>
    <circle cx="40" cy="50" r="3" fill="#fff" opacity=".8"/>
    <circle cx="90" cy="32" r="2" fill="#fff" opacity=".8"/>
  </svg>`);
}
