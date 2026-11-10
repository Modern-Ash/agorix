import { validKidsImageDataUrl } from "./kidsImages.js";

/**
 * Ori's ideas for changing a child's own picture (issue #1308). Every idea is one fixed
 * transformation of the pixels that are already there, chosen from this closed list: Ori does not
 * draw, and nothing here reads a model. The result is only ever shown beside the picture it came
 * from, and the child decides.
 */
export const ART_VARIATIONS = ["mirror", "flip", "turn", "hue", "lighter", "darker"] as const;
export type ArtVariation = (typeof ART_VARIATIONS)[number];

export function isArtVariation(value: unknown): value is ArtVariation {
  return (ART_VARIATIONS as readonly unknown[]).includes(value);
}

export const ART_VARIATION_TEXT: Readonly<
  Record<ArtVariation, { readonly es: string; readonly en: string }>
> = {
  mirror: { es: "Espejarlo", en: "Mirror it" },
  flip: { es: "Darlo vuelta", en: "Flip it upside down" },
  turn: { es: "Girarlo un cuarto", en: "Turn it a quarter" },
  hue: { es: "Cambiar los colores", en: "Change the colours" },
  lighter: { es: "Aclararlo", en: "Make it lighter" },
  darker: { es: "Oscurecerlo", en: "Make it darker" },
};

/** Pixels of a square picture, four bytes each (red, green, blue, alpha), row by row. */
function square(data: Uint8ClampedArray, side: number): void {
  if (!Number.isInteger(side) || side < 1 || data.length !== side * side * 4)
    throw new RangeError("expected a square picture");
}

function copyPixel(
  from: Uint8ClampedArray,
  fromAt: number,
  to: Uint8ClampedArray,
  toAt: number,
): void {
  to[toAt] = from[fromAt]!;
  to[toAt + 1] = from[fromAt + 1]!;
  to[toAt + 2] = from[fromAt + 2]!;
  to[toAt + 3] = from[fromAt + 3]!;
}

export function mirrorPixels(data: Uint8ClampedArray, side: number): Uint8ClampedArray {
  square(data, side);
  const out = new Uint8ClampedArray(data.length);
  for (let y = 0; y < side; y += 1)
    for (let x = 0; x < side; x += 1)
      copyPixel(data, (y * side + x) * 4, out, (y * side + (side - 1 - x)) * 4);
  return out;
}

export function flipPixels(data: Uint8ClampedArray, side: number): Uint8ClampedArray {
  square(data, side);
  const out = new Uint8ClampedArray(data.length);
  for (let y = 0; y < side; y += 1)
    for (let x = 0; x < side; x += 1)
      copyPixel(data, (y * side + x) * 4, out, ((side - 1 - y) * side + x) * 4);
  return out;
}

/** A quarter turn clockwise. */
export function turnPixels(data: Uint8ClampedArray, side: number): Uint8ClampedArray {
  square(data, side);
  const out = new Uint8ClampedArray(data.length);
  for (let y = 0; y < side; y += 1)
    for (let x = 0; x < side; x += 1)
      copyPixel(data, (y * side + x) * 4, out, (x * side + (side - 1 - y)) * 4);
  return out;
}

function toHsl(r: number, g: number, b: number): [number, number, number] {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  const delta = max - min;
  if (delta === 0) return [0, 0, lightness];
  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue: number;
  if (max === red) hue = ((green - blue) / delta + (green < blue ? 6 : 0)) * 60;
  else if (max === green) hue = ((blue - red) / delta + 2) * 60;
  else hue = ((red - green) / delta + 4) * 60;
  return [hue, saturation, lightness];
}

function fromHsl(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

/** Every colour turned the same way round the colour wheel; greys and transparency stay as they are. */
export function shiftHuePixels(
  data: Uint8ClampedArray,
  side: number,
  degrees: number,
): Uint8ClampedArray {
  square(data, side);
  const out = new Uint8ClampedArray(data);
  for (let at = 0; at < data.length; at += 4) {
    const [h, s, l] = toHsl(data[at]!, data[at + 1]!, data[at + 2]!);
    if (s === 0) continue;
    const [r, g, b] = fromHsl((((h + degrees) % 360) + 360) % 360, s, l);
    out[at] = r;
    out[at + 1] = g;
    out[at + 2] = b;
  }
  return out;
}

/** Lighter (positive) or darker (negative) by this many of 255; transparency stays as it is. */
export function shiftBrightnessPixels(
  data: Uint8ClampedArray,
  side: number,
  delta: number,
): Uint8ClampedArray {
  square(data, side);
  const out = new Uint8ClampedArray(data);
  for (let at = 0; at < data.length; at += 4) {
    out[at] = data[at]! + delta;
    out[at + 1] = data[at + 1]! + delta;
    out[at + 2] = data[at + 2]! + delta;
  }
  return out;
}

export function applyArtVariation(
  data: Uint8ClampedArray,
  side: number,
  variation: ArtVariation,
): Uint8ClampedArray {
  switch (variation) {
    case "mirror":
      return mirrorPixels(data, side);
    case "flip":
      return flipPixels(data, side);
    case "turn":
      return turnPixels(data, side);
    case "hue":
      return shiftHuePixels(data, side, 120);
    case "lighter":
      return shiftBrightnessPixels(data, side, 50);
    case "darker":
      return shiftBrightnessPixels(data, side, -50);
  }
}

const OUTPUT_LIMIT = 60 * 1024;

/**
 * The picture with the idea applied, as a data URL a project accepts, or null when the browser
 * cannot produce one (it never throws into the editor). Local only: the picture goes nowhere.
 */
export async function varyArt(source: string, variation: ArtVariation): Promise<string | null> {
  if (!validKidsImageDataUrl(source) || !isArtVariation(variation)) return null;
  try {
    const image = new Image();
    image.src = source;
    await image.decode();
    const side = image.naturalWidth;
    if (side < 1 || side > 1024 || image.naturalHeight !== side) return null;
    const canvas = document.createElement("canvas");
    canvas.width = side;
    canvas.height = side;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, side, side);
    context.putImageData(
      new ImageData(applyArtVariation(pixels.data, side, variation) as never, side, side),
      0,
      0,
    );
    for (const type of ["image/png", "image/webp"] as const) {
      const url = canvas.toDataURL(type, 0.82);
      if (
        url.startsWith(`data:${type};base64,`) &&
        Math.ceil((url.length - url.indexOf(",") - 1) * 0.75) < OUTPUT_LIMIT &&
        validKidsImageDataUrl(url)
      )
        return url;
    }
    return null;
  } catch {
    return null;
  }
}
