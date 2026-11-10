import { validEmbeddedImageSource } from "@agorix/program-model";

export const ART_DOCUMENT_SCHEMA = "agorix/art-document/v1";

/** What a document is for: a costume is square, a backdrop fills the stage. */
export const ART_KINDS = {
  costume: { width: 240, height: 240 },
  backdrop: { width: 480, height: 360 },
} as const;
export type ArtKind = keyof typeof ART_KINDS;

/** The closed palette of a drawing: a child picks one of these, never a free colour. */
export const ART_PALETTE = [
  "#000000",
  "#ffffff",
  "#e03131",
  "#f08c00",
  "#fcc419",
  "#2f9e44",
  "#1971c2",
  "#0ca5b0",
  "#7048e8",
  "#e64980",
  "#8d5524",
  "#868e96",
  "#ffd8a8",
  "#b2f2bb",
  "#a5d8ff",
  "#d0bfff",
] as const;
export type ArtColor = (typeof ART_PALETTE)[number];

export const ART_STROKE_WIDTHS = [1, 2, 4, 8, 12] as const;
export type ArtStrokeWidth = (typeof ART_STROKE_WIDTHS)[number];
export const ART_TEXT_SIZES = [12, 16, 24, 32, 48] as const;
export type ArtTextSize = (typeof ART_TEXT_SIZES)[number];

export const MAX_ART_SHAPES = 60;
export const MAX_STROKE_POINTS = 64;
export const MAX_ART_TEXT_LENGTH = 20;
export const MAX_ART_BITMAPS = 2;

interface ShapeBase {
  /** Stable within the document: `s1`, `s2`... */
  readonly id: string;
}
interface Painted {
  /** The inside colour, or none. */
  readonly fill: ArtColor | null;
  readonly stroke: ArtColor | null;
  readonly strokeWidth: ArtStrokeWidth;
}

export interface ArtRect extends ShapeBase, Painted {
  readonly type: "rect";
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}
export interface ArtEllipse extends ShapeBase, Painted {
  readonly type: "ellipse";
  readonly cx: number;
  readonly cy: number;
  readonly rx: number;
  readonly ry: number;
}
export interface ArtLine extends ShapeBase {
  readonly type: "line";
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly stroke: ArtColor;
  readonly strokeWidth: ArtStrokeWidth;
}
/** A free hand line: its points, in order. */
export interface ArtStroke extends ShapeBase {
  readonly type: "stroke";
  readonly points: readonly (readonly [number, number])[];
  readonly stroke: ArtColor;
  readonly strokeWidth: ArtStrokeWidth;
}
export interface ArtText extends ShapeBase {
  readonly type: "text";
  readonly x: number;
  readonly y: number;
  readonly text: string;
  readonly size: ArtTextSize;
  readonly fill: ArtColor;
}
/** An imported picture, already a bounded PNG or WebP (the same rule as every project asset). */
export interface ArtBitmap extends ShapeBase {
  readonly type: "bitmap";
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly source: string;
}
export type ArtShape = ArtRect | ArtEllipse | ArtLine | ArtStroke | ArtText | ArtBitmap;

export interface ArtDocument {
  readonly schema: typeof ART_DOCUMENT_SCHEMA;
  readonly kind: ArtKind;
  /** The colour behind everything, or transparent. */
  readonly background: ArtColor | null;
  /** Painted first to last: later shapes are on top. */
  readonly shapes: readonly ArtShape[];
}

export type ArtDocumentErrorCode =
  | "INVALID_ROOT"
  | "UNKNOWN_FIELD"
  | "INVALID_FIELD"
  | "OUT_OF_BOUNDS"
  | "TOO_MANY"
  | "DUPLICATE_ID";

export class ArtDocumentError extends Error {
  constructor(
    readonly code: ArtDocumentErrorCode,
    readonly path: string,
    message: string,
  ) {
    super(`${code} ${path}: ${message}`);
    this.name = "ArtDocumentError";
  }
}

const fail = (code: ArtDocumentErrorCode, path: string, message: string): never => {
  throw new ArtDocumentError(code, path, message);
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function keys(input: Record<string, unknown>, allowed: readonly string[], path: string): void {
  for (const key of Object.keys(input))
    if (!allowed.includes(key)) fail("UNKNOWN_FIELD", `${path}.${key}`, "unexpected field");
}

function color(value: unknown, path: string): ArtColor {
  if (!(ART_PALETTE as readonly unknown[]).includes(value))
    fail("INVALID_FIELD", path, "expected a colour from the palette");
  return value as ArtColor;
}
function optionalColor(value: unknown, path: string): ArtColor | null {
  return value === null ? null : color(value, path);
}
function width(value: unknown, path: string): ArtStrokeWidth {
  if (!(ART_STROKE_WIDTHS as readonly unknown[]).includes(value))
    fail("INVALID_FIELD", path, "expected a stroke width from the list");
  return value as ArtStrokeWidth;
}

/** A whole number on the canvas, from 0 to its side. */
function coordinate(value: unknown, path: string, side: number): number {
  if (typeof value !== "number" || !Number.isInteger(value))
    fail("INVALID_FIELD", path, "expected a whole number");
  if ((value as number) < 0 || (value as number) > side)
    fail("OUT_OF_BOUNDS", path, `expected 0 to ${side}`);
  return value as number;
}
/** A size: at least 1, at most the side. */
function extent(value: unknown, path: string, side: number): number {
  const number = coordinate(value, path, side);
  if (number < 1) fail("OUT_OF_BOUNDS", path, "expected at least 1");
  return number;
}

/** Letters, digits and spaces only: a bubble of text, never markup. */
const TEXT_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N} ]*$/u;

function shape(
  input: unknown,
  path: string,
  size: { width: number; height: number },
  ids: Set<string>,
  bitmaps: { count: number },
): ArtShape {
  if (!isObject(input)) return fail("INVALID_FIELD", path, "expected an object");
  const id = input["id"];
  if (typeof id !== "string" || !/^s[1-9][0-9]{0,2}$/.test(id))
    fail("INVALID_FIELD", `${path}.id`, "expected an id like s1");
  if (ids.has(id as string)) fail("DUPLICATE_ID", `${path}.id`, "id already used");
  ids.add(id as string);
  const base = { id: id as string };
  const paint = () => ({
    fill: optionalColor(input["fill"], `${path}.fill`),
    stroke: optionalColor(input["stroke"], `${path}.stroke`),
    strokeWidth: width(input["strokeWidth"], `${path}.strokeWidth`),
  });
  switch (input["type"]) {
    case "rect":
      keys(
        input,
        ["id", "type", "x", "y", "width", "height", "fill", "stroke", "strokeWidth"],
        path,
      );
      return {
        ...base,
        type: "rect",
        x: coordinate(input["x"], `${path}.x`, size.width),
        y: coordinate(input["y"], `${path}.y`, size.height),
        width: extent(input["width"], `${path}.width`, size.width),
        height: extent(input["height"], `${path}.height`, size.height),
        ...paint(),
      };
    case "ellipse":
      keys(input, ["id", "type", "cx", "cy", "rx", "ry", "fill", "stroke", "strokeWidth"], path);
      return {
        ...base,
        type: "ellipse",
        cx: coordinate(input["cx"], `${path}.cx`, size.width),
        cy: coordinate(input["cy"], `${path}.cy`, size.height),
        rx: extent(input["rx"], `${path}.rx`, size.width),
        ry: extent(input["ry"], `${path}.ry`, size.height),
        ...paint(),
      };
    case "line":
      keys(input, ["id", "type", "x1", "y1", "x2", "y2", "stroke", "strokeWidth"], path);
      return {
        ...base,
        type: "line",
        x1: coordinate(input["x1"], `${path}.x1`, size.width),
        y1: coordinate(input["y1"], `${path}.y1`, size.height),
        x2: coordinate(input["x2"], `${path}.x2`, size.width),
        y2: coordinate(input["y2"], `${path}.y2`, size.height),
        stroke: color(input["stroke"], `${path}.stroke`),
        strokeWidth: width(input["strokeWidth"], `${path}.strokeWidth`),
      };
    case "stroke": {
      keys(input, ["id", "type", "points", "stroke", "strokeWidth"], path);
      const points = input["points"];
      if (!Array.isArray(points) || points.length < 2)
        fail("INVALID_FIELD", `${path}.points`, "expected at least two points");
      if ((points as unknown[]).length > MAX_STROKE_POINTS)
        fail("TOO_MANY", `${path}.points`, `expected at most ${MAX_STROKE_POINTS} points`);
      return {
        ...base,
        type: "stroke",
        points: (points as unknown[]).map((point, index) => {
          if (!Array.isArray(point) || point.length !== 2)
            return fail("INVALID_FIELD", `${path}.points[${index}]`, "expected [x, y]");
          return [
            coordinate(point[0], `${path}.points[${index}][0]`, size.width),
            coordinate(point[1], `${path}.points[${index}][1]`, size.height),
          ] as const;
        }),
        stroke: color(input["stroke"], `${path}.stroke`),
        strokeWidth: width(input["strokeWidth"], `${path}.strokeWidth`),
      };
    }
    case "text": {
      keys(input, ["id", "type", "x", "y", "text", "size", "fill"], path);
      const text = input["text"];
      if (typeof text !== "string" || !TEXT_PATTERN.test(text))
        fail("INVALID_FIELD", `${path}.text`, "expected letters, digits and spaces");
      if ((text as string).length > MAX_ART_TEXT_LENGTH)
        fail("OUT_OF_BOUNDS", `${path}.text`, `expected at most ${MAX_ART_TEXT_LENGTH} letters`);
      if (!(ART_TEXT_SIZES as readonly unknown[]).includes(input["size"]))
        fail("INVALID_FIELD", `${path}.size`, "expected a text size from the list");
      return {
        ...base,
        type: "text",
        x: coordinate(input["x"], `${path}.x`, size.width),
        y: coordinate(input["y"], `${path}.y`, size.height),
        text: text as string,
        size: input["size"] as ArtTextSize,
        fill: color(input["fill"], `${path}.fill`),
      };
    }
    case "bitmap": {
      keys(input, ["id", "type", "x", "y", "width", "height", "source"], path);
      bitmaps.count += 1;
      if (bitmaps.count > MAX_ART_BITMAPS)
        fail("TOO_MANY", path, `expected at most ${MAX_ART_BITMAPS} pictures`);
      if (!validEmbeddedImageSource(input["source"]))
        fail("INVALID_FIELD", `${path}.source`, "expected a bounded PNG or WebP picture");
      return {
        ...base,
        type: "bitmap",
        x: coordinate(input["x"], `${path}.x`, size.width),
        y: coordinate(input["y"], `${path}.y`, size.height),
        width: extent(input["width"], `${path}.width`, size.width),
        height: extent(input["height"], `${path}.height`, size.height),
        source: input["source"] as string,
      };
    }
    default:
      return fail("INVALID_FIELD", `${path}.type`, "expected a known shape");
  }
}

/** Checks an untrusted document and returns it as a clean value, or throws `ArtDocumentError`. */
export function validateArtDocument(input: unknown): ArtDocument {
  if (!isObject(input)) return fail("INVALID_ROOT", "$", "expected an object");
  keys(input, ["schema", "kind", "background", "shapes"], "$");
  if (input["schema"] !== ART_DOCUMENT_SCHEMA)
    fail("INVALID_ROOT", "$.schema", `expected ${ART_DOCUMENT_SCHEMA}`);
  const kind = input["kind"];
  if (kind !== "costume" && kind !== "backdrop")
    fail("INVALID_FIELD", "$.kind", "expected costume or backdrop");
  const size = ART_KINDS[kind as ArtKind];
  const shapes = input["shapes"];
  if (!Array.isArray(shapes)) return fail("INVALID_FIELD", "$.shapes", "expected a list");
  if (shapes.length > MAX_ART_SHAPES)
    fail("TOO_MANY", "$.shapes", `expected at most ${MAX_ART_SHAPES} shapes`);
  const ids = new Set<string>();
  const bitmaps = { count: 0 };
  return {
    schema: ART_DOCUMENT_SCHEMA,
    kind: kind as ArtKind,
    background: optionalColor(input["background"], "$.background"),
    shapes: shapes.map((item, index) => shape(item, `$.shapes[${index}]`, size, ids, bitmaps)),
  };
}

export function createArtDocument(kind: ArtKind): ArtDocument {
  return { schema: ART_DOCUMENT_SCHEMA, kind, background: null, shapes: [] };
}
