import { validKidsImageDataUrl } from "./kidsImages.js";

/**
 * A spoken description of a child's own picture, for people who cannot see it (issue #1308).
 * It is worked out on the device from the pixels alone, from a closed list of colour words, so no
 * file text, no model and no network ever reaches it. The words are sentences this app wrote; the
 * picture only decides which of them are used.
 */
export const ART_COLORS = [
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
  "brown",
  "white",
  "grey",
  "black",
] as const;
export type ArtColor = (typeof ART_COLORS)[number];

const COLOR_WORDS: Readonly<Record<ArtColor, Readonly<Record<"es" | "en", string>>>> = {
  red: { es: "rojo", en: "red" },
  orange: { es: "naranja", en: "orange" },
  yellow: { es: "amarillo", en: "yellow" },
  green: { es: "verde", en: "green" },
  blue: { es: "azul", en: "blue" },
  purple: { es: "morado", en: "purple" },
  pink: { es: "rosa", en: "pink" },
  brown: { es: "marrón", en: "brown" },
  white: { es: "blanco", en: "white" },
  grey: { es: "gris", en: "grey" },
  black: { es: "negro", en: "black" },
};

/** The colour word of one opaque pixel. */
export function artColorOf(r: number, g: number, b: number): ArtColor {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255] as const;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const lightness = (max + min) / 2;
  const delta = max - min;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  if (lightness < 0.15) return "black";
  if (lightness > 0.9) return "white";
  if (saturation < 0.15) return lightness > 0.8 ? "white" : "grey";
  let hue: number;
  if (max === rn) hue = ((gn - bn) / delta + (gn < bn ? 6 : 0)) * 60;
  else if (max === gn) hue = ((bn - rn) / delta + 2) * 60;
  else hue = ((rn - gn) / delta + 4) * 60;
  if (hue < 15 || hue >= 345) return lightness > 0.7 ? "pink" : "red";
  if (hue < 45) return lightness < 0.45 ? "brown" : "orange";
  if (hue < 70) return "yellow";
  if (hue < 165) return "green";
  if (hue < 255) return "blue";
  return lightness > 0.7 ? "pink" : "purple";
}

export interface ArtSummary {
  /** Share of the picture that is drawn (not see-through), 0–1. */
  readonly filled: number;
  /** Up to three colours, biggest first, each at least 10% of the drawn part. */
  readonly colors: readonly ArtColor[];
}

/** The summary of RGBA pixels. Pure and deterministic. */
export function summarizeArtPixels(data: Uint8ClampedArray): ArtSummary {
  const counts = new Map<ArtColor, number>();
  const total = Math.floor(data.length / 4);
  let drawn = 0;
  for (let index = 0; index < total; index += 1) {
    const at = index * 4;
    if (data[at + 3]! < 128) continue;
    drawn += 1;
    const color = artColorOf(data[at]!, data[at + 1]!, data[at + 2]!);
    counts.set(color, (counts.get(color) ?? 0) + 1);
  }
  const colors = [...counts.entries()]
    .filter(([, count]) => drawn > 0 && count / drawn >= 0.1)
    .sort((a, b) => b[1] - a[1] || ART_COLORS.indexOf(a[0]) - ART_COLORS.indexOf(b[0]))
    .slice(0, 3)
    .map(([color]) => color);
  return { filled: total === 0 ? 0 : drawn / total, colors };
}

export type ArtKind = "costume" | "backdrop";

/** The sentence for a summary, in the child's language. Never longer than a short line. */
export function describeArtSummary(summary: ArtSummary, kind: ArtKind, lang: "es" | "en"): string {
  const what =
    kind === "costume"
      ? lang === "es"
        ? "Tu dibujo"
        : "Your drawing"
      : lang === "es"
        ? "Tu fondo"
        : "Your backdrop";
  if (summary.colors.length === 0 || summary.filled < 0.02)
    return lang === "es" ? `${what}: casi vacío.` : `${what}: almost empty.`;
  const words = summary.colors.map((color) => COLOR_WORDS[color][lang]);
  const list =
    words.length === 1
      ? words[0]!
      : `${words.slice(0, -1).join(", ")} ${lang === "es" ? "y" : "and"} ${words[words.length - 1]!}`;
  const cover =
    summary.filled < 0.35
      ? lang === "es"
        ? "ocupa poco espacio"
        : "takes little space"
      : summary.filled < 0.75
        ? lang === "es"
          ? "ocupa buena parte"
          : "fills a good part"
        : lang === "es"
          ? "llena todo el cuadro"
          : "fills the whole picture";
  return lang === "es" ? `${what}: ${cover}, con ${list}.` : `${what}: ${cover}, in ${list}.`;
}

/**
 * The description of a picture given as a data URL, or null when it cannot be read (the picture is
 * then simply left with its name). Local only: nothing is sent anywhere.
 */
export async function describeArt(
  source: string,
  kind: ArtKind,
  lang: "es" | "en",
): Promise<string | null> {
  if (!validKidsImageDataUrl(source)) return null;
  try {
    const image = new Image();
    image.src = source;
    await image.decode();
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    if (width < 1 || height < 1 || width > 1024 || height > 1024) return null;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(image, 0, 0);
    return describeArtSummary(
      summarizeArtPixels(context.getImageData(0, 0, width, height).data),
      kind,
      lang,
    );
  } catch {
    return null;
  }
}

/** The key a description is remembered under: it changes whenever the picture or language does. */
export function artWordsKey(id: string, source: string, lang: "es" | "en"): string {
  return `${id}:${source.length}:${lang}`;
}
