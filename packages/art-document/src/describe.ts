import { type ArtColor, type ArtDocument, type ArtShape } from "./document.js";

export type ArtLocale = "es" | "en";

const COLOR_NAMES: Record<ArtLocale, Record<ArtColor, string>> = {
  es: {
    "#000000": "negro",
    "#ffffff": "blanco",
    "#e03131": "rojo",
    "#f08c00": "naranja",
    "#fcc419": "amarillo",
    "#2f9e44": "verde",
    "#1971c2": "azul",
    "#0ca5b0": "turquesa",
    "#7048e8": "violeta",
    "#e64980": "rosa",
    "#8d5524": "marrón",
    "#868e96": "gris",
    "#ffd8a8": "durazno",
    "#b2f2bb": "verde claro",
    "#a5d8ff": "celeste",
    "#d0bfff": "lila",
  },
  en: {
    "#000000": "black",
    "#ffffff": "white",
    "#e03131": "red",
    "#f08c00": "orange",
    "#fcc419": "yellow",
    "#2f9e44": "green",
    "#1971c2": "blue",
    "#0ca5b0": "teal",
    "#7048e8": "violet",
    "#e64980": "pink",
    "#8d5524": "brown",
    "#868e96": "grey",
    "#ffd8a8": "peach",
    "#b2f2bb": "light green",
    "#a5d8ff": "light blue",
    "#d0bfff": "lilac",
  },
};

function shapeText(shape: ArtShape, locale: ArtLocale): string {
  const names = COLOR_NAMES[locale];
  const es = locale === "es";
  const main = "fill" in shape && shape.fill !== null ? names[shape.fill] : undefined;
  const line = "stroke" in shape && shape.stroke !== null ? names[shape.stroke] : undefined;
  const colour = main ?? line;
  switch (shape.type) {
    case "rect":
      return es
        ? `un rectángulo${colour ? ` ${colour}` : ""}`
        : `a ${colour ? `${colour} ` : ""}rectangle`;
    case "ellipse":
      return es
        ? `una elipse${colour ? ` ${colour}` : ""}`
        : `a ${colour ? `${colour} ` : ""}ellipse`;
    case "line":
      return es ? `una línea ${names[shape.stroke]}` : `a ${names[shape.stroke]} line`;
    case "stroke":
      return es ? `un trazo ${names[shape.stroke]}` : `a ${names[shape.stroke]} stroke`;
    case "text":
      return es ? `el texto «${shape.text}»` : `the text “${shape.text}”`;
    case "bitmap":
      return es ? "una imagen importada" : "an imported picture";
  }
}

/** What the picture holds, in words, for someone who cannot see it. Built from the shapes only. */
export function describeArtDocument(document: ArtDocument, locale: ArtLocale = "es"): string {
  const es = locale === "es";
  const what =
    document.kind === "costume"
      ? es
        ? "Un disfraz"
        : "A costume"
      : es
        ? "Un fondo"
        : "A backdrop";
  const back =
    document.background === null
      ? ""
      : es
        ? ` con fondo ${COLOR_NAMES.es[document.background]}`
        : ` with a ${COLOR_NAMES.en[document.background]} background`;
  if (document.shapes.length === 0) return es ? `${what} vacío${back}.` : `${what}, empty${back}.`;
  const list = document.shapes.map((item) => shapeText(item, locale));
  const count = list.length;
  const joined =
    list.length === 1
      ? list[0]!
      : `${list.slice(0, -1).join(", ")} ${es ? "y" : "and"} ${list[list.length - 1]}`;
  return es
    ? `${what}${back}, con ${count} ${count === 1 ? "forma" : "formas"}: ${joined}.`
    : `${what}${back}, with ${count} ${count === 1 ? "shape" : "shapes"}: ${joined}.`;
}
