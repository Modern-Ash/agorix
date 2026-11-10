/**
 * The way an untrusted SVG becomes safe to draw: parsed by a small tokenizer, kept only if it is
 * built from an allow-list of elements and attributes with checked values, and written out again
 * from that tree. Nothing the input says is passed through, so what is not understood is not
 * trusted. No DOM and no browser API: this runs anywhere the document model does.
 */
export type SvgRefusal =
  | "tooLarge"
  | "malformed"
  | "badCharacters"
  | "forbiddenMarkup"
  | "unsupportedElement"
  | "forbiddenAttribute"
  | "badValue"
  | "tooComplex"
  | "noSize";

export class SvgSanitizeError extends Error {
  constructor(
    readonly code: SvgRefusal,
    message: string,
  ) {
    super(`${code}: ${message}`);
    this.name = "SvgSanitizeError";
  }
}

const fail = (code: SvgRefusal, message: string): never => {
  throw new SvgSanitizeError(code, message);
};

export const MAX_SVG_INPUT_CHARS = 64 * 1024;
const MAX_ELEMENTS = 400;
const MAX_DEPTH = 12;
const MAX_ATTRIBUTES = 24;
const MAX_TEXT = 200;

const ELEMENTS = new Set([
  "svg",
  "g",
  "path",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "text",
  "tspan",
  "title",
  "desc",
]);
const TEXT_ELEMENTS = new Set(["text", "tspan", "title", "desc"]);

/** Attribute name (lowercase) to how its value is checked and its canonical spelling. */
type Check =
  | "length"
  | "viewBox"
  | "points"
  | "path"
  | "paint"
  | "transform"
  | "unit"
  | "font"
  | "anchor"
  | "cap"
  | "join"
  | "rule";
const ATTRIBUTES: Readonly<Record<string, { name: string; check: Check }>> = {
  viewbox: { name: "viewBox", check: "viewBox" },
  x: { name: "x", check: "length" },
  y: { name: "y", check: "length" },
  width: { name: "width", check: "length" },
  height: { name: "height", check: "length" },
  cx: { name: "cx", check: "length" },
  cy: { name: "cy", check: "length" },
  r: { name: "r", check: "length" },
  rx: { name: "rx", check: "length" },
  ry: { name: "ry", check: "length" },
  x1: { name: "x1", check: "length" },
  y1: { name: "y1", check: "length" },
  x2: { name: "x2", check: "length" },
  y2: { name: "y2", check: "length" },
  points: { name: "points", check: "points" },
  d: { name: "d", check: "path" },
  fill: { name: "fill", check: "paint" },
  stroke: { name: "stroke", check: "paint" },
  "stroke-width": { name: "stroke-width", check: "length" },
  "stroke-linecap": { name: "stroke-linecap", check: "cap" },
  "stroke-linejoin": { name: "stroke-linejoin", check: "join" },
  opacity: { name: "opacity", check: "unit" },
  "fill-opacity": { name: "fill-opacity", check: "unit" },
  "stroke-opacity": { name: "stroke-opacity", check: "unit" },
  "fill-rule": { name: "fill-rule", check: "rule" },
  transform: { name: "transform", check: "transform" },
  "font-size": { name: "font-size", check: "length" },
  "font-family": { name: "font-family", check: "font" },
  "text-anchor": { name: "text-anchor", check: "anchor" },
};

const NAMED_COLOURS = new Set([
  "none",
  "black",
  "white",
  "red",
  "green",
  "blue",
  "yellow",
  "orange",
  "purple",
  "pink",
  "brown",
  "gray",
  "grey",
  "transparent",
]);

function checkValue(check: Check, raw: string, name: string): string {
  const value = raw.trim();
  const bad = (): never => fail("badValue", `${name} has a value that is not allowed`);
  switch (check) {
    case "length":
      return /^-?\d{1,6}(\.\d{1,6})?(px)?$/.test(value) ? value : bad();
    case "unit":
      return /^(0|1|0?\.\d{1,6}|1\.0+)$/.test(value) ? value : bad();
    case "viewBox":
      return /^-?\d{1,6}(\.\d+)?([ ,]+-?\d{1,6}(\.\d+)?){3}$/.test(value) ? value : bad();
    case "points":
      return value.length <= 2000 && /^[-0-9.,\s]*$/.test(value) ? value : bad();
    case "path":
      return value.length <= 4000 && /^[MmLlHhVvCcSsQqTtAaZz0-9eE+\-.,\s]*$/.test(value)
        ? value
        : bad();
    case "paint": {
      const lower = value.toLowerCase();
      if (NAMED_COLOURS.has(lower)) return lower;
      if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)) return value.toLowerCase();
      if (/^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/i.test(value)) return value;
      return bad();
    }
    case "transform":
      return /^(\s*(translate|scale|rotate|matrix|skewX|skewY)\(\s*[-0-9.,\s]+\)\s*)*$/.test(value)
        ? value
        : bad();
    case "font":
      return value.length <= 60 && /^[A-Za-z0-9 ,'-]*$/.test(value) ? value : bad();
    case "anchor":
      return ["start", "middle", "end"].includes(value) ? value : bad();
    case "cap":
      return ["butt", "round", "square"].includes(value) ? value : bad();
    case "join":
      return ["miter", "round", "bevel"].includes(value) ? value : bad();
    case "rule":
      return ["nonzero", "evenodd"].includes(value) ? value : bad();
  }
}

interface Node {
  readonly tag: string;
  readonly attributes: [string, string][];
  readonly children: (Node | string)[];
}

const escapeAttribute = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const escapeText = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The five entities XML has; anything else (a numeric reference, a declared entity) is refused. */
function decodeText(raw: string): string {
  return raw.replace(/&([^;\s]{1,10});?/g, (_all, name: string) => {
    const table: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
    const decoded = table[name];
    if (decoded === undefined) return fail("forbiddenMarkup", "an entity or character reference");
    return decoded;
  });
}

const FORBIDDEN_ELEMENTS = new Set([
  "script",
  "foreignobject",
  "use",
  "image",
  "iframe",
  "object",
  "embed",
  "style",
  "link",
  "a",
  "animate",
  "animatemotion",
  "animatetransform",
  "set",
  "filter",
  "mask",
  "pattern",
  "marker",
  "symbol",
  "switch",
  "audio",
  "video",
  "canvas",
  "html",
  "body",
  "meta",
  "base",
]);

/** `style="fill:red;stroke:#000"` to attributes, keeping only the properties the model knows. */
function styleToAttributes(value: string): [string, string][] {
  if (value.length > 600) fail("badValue", "style is too long");
  const out: [string, string][] = [];
  for (const part of value.split(";")) {
    const trimmed = part.trim();
    if (trimmed === "") continue;
    const at = trimmed.indexOf(":");
    if (at < 0) fail("badValue", "style is not a list of properties");
    const key = trimmed.slice(0, at).trim().toLowerCase();
    const known = ATTRIBUTES[key];
    if (known === undefined) continue;
    out.push([known.name, checkValue(known.check, trimmed.slice(at + 1), known.name)]);
  }
  return out;
}

/** Whether the text has a control character (tab, line feed and return count only when allowed). */
function hasControl(text: string, allowWhitespace: boolean): boolean {
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code < 32 && !(allowWhitespace && (code === 9 || code === 10 || code === 13))) return true;
  }
  return false;
}

function parse(source: string): Node {
  let index = 0;
  let elements = 0;
  const stack: Node[] = [];
  let root: Node | undefined;
  while (index < source.length) {
    const lt = source.indexOf("<", index);
    const text = source.slice(index, lt < 0 ? source.length : lt);
    if (text.trim() !== "") {
      const parent = stack[stack.length - 1];
      if (parent === undefined) fail("malformed", "text outside the picture");
      else if (TEXT_ELEMENTS.has(parent.tag)) {
        const decoded = decodeText(text);
        if (decoded.length > MAX_TEXT) fail("tooComplex", "a text is too long");
        parent.children.push(decoded);
      }
      // Text inside a shape or a group means nothing; it is left out.
    }
    if (lt < 0) break;
    index = lt;
    if (source.startsWith("<!--", index)) {
      const end = source.indexOf("-->", index + 4);
      if (end < 0) fail("malformed", "a comment never ends");
      index = end + 3;
      continue;
    }
    if (source.startsWith("<!", index) || source.startsWith("<?", index))
      fail("forbiddenMarkup", "a declaration, an entity or a processing instruction");
    if (source.startsWith("</", index)) {
      const end = source.indexOf(">", index);
      if (end < 0) fail("malformed", "a closing tag never ends");
      const name = source
        .slice(index + 2, end)
        .trim()
        .toLowerCase();
      const open = stack.pop();
      if (open === undefined || open.tag !== name) fail("malformed", "tags do not match");
      index = end + 1;
      continue;
    }
    const tag = /^<([A-Za-z][A-Za-z0-9:_-]*)/.exec(source.slice(index, index + 64));
    if (tag === null) return fail("malformed", "a tag with no name");
    const name = tag[1]!.toLowerCase();
    if (FORBIDDEN_ELEMENTS.has(name) || name.includes(":"))
      fail("unsupportedElement", `<${name}> is not allowed`);
    if (!ELEMENTS.has(name)) fail("unsupportedElement", `<${name}> is not supported`);
    index += tag[0].length;
    const attributes: [string, string][] = [];
    const seen = new Set<string>();
    let selfClosing = false;
    let count = 0;
    for (;;) {
      while (index < source.length && /\s/.test(source[index]!)) index += 1;
      if (index >= source.length) fail("malformed", "a tag never ends");
      if (source[index] === ">") {
        index += 1;
        break;
      }
      if (source.startsWith("/>", index)) {
        selfClosing = true;
        index += 2;
        break;
      }
      const attribute = /^([A-Za-z_:][-A-Za-z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)')/.exec(
        source.slice(index, index + 8000),
      );
      if (attribute === null) fail("malformed", 'an attribute that is not name="value"');
      const raw = attribute![1]!;
      const lower = raw.toLowerCase();
      const value = attribute![3] ?? attribute![4] ?? "";
      index += attribute![0].length;
      count += 1;
      if (count > MAX_ATTRIBUTES) fail("tooComplex", "too many attributes");
      if (lower.startsWith("on") || lower.includes("href") || lower === "src")
        fail("forbiddenAttribute", `${raw} is not allowed`);
      if (hasControl(value, false)) fail("badCharacters", "control characters in a value");
      if (lower === "style") {
        for (const pair of styleToAttributes(decodeText(value)))
          if (!seen.has(pair[0])) {
            seen.add(pair[0]);
            attributes.push(pair);
          }
        continue;
      }
      const known = ATTRIBUTES[lower];
      if (known === undefined) continue;
      if (seen.has(known.name)) continue;
      seen.add(known.name);
      attributes.push([known.name, checkValue(known.check, decodeText(value), known.name)]);
    }
    elements += 1;
    if (elements > MAX_ELEMENTS) fail("tooComplex", "too many elements");
    const node: Node = { tag: name, attributes, children: [] };
    const parent = stack[stack.length - 1];
    if (parent === undefined) {
      if (root !== undefined || name !== "svg") fail("malformed", "expected one <svg> picture");
      root = node;
    } else parent.children.push(node);
    if (!selfClosing) {
      stack.push(node);
      if (stack.length > MAX_DEPTH) fail("tooComplex", "nested too deeply");
    }
  }
  if (stack.length > 0) fail("malformed", "a tag was never closed");
  if (root === undefined) return fail("malformed", "no <svg> picture");
  return root;
}

function write(node: Node): string {
  const attributes = node.attributes
    .map(([name, value]) => ` ${name}="${escapeAttribute(value)}"`)
    .join("");
  const inner = node.children
    .map((child) => (typeof child === "string" ? escapeText(child) : write(child)))
    .join("");
  return node.children.length === 0 && node.tag !== "text"
    ? `<${node.tag}${attributes}/>`
    : `<${node.tag}${attributes}>${inner}</${node.tag}>`;
}

/**
 * An SVG the editor may draw, or a refusal that says why. The result has no script, no event
 * handler, no link, no style sheet, no external reference and no entity, whatever the input had.
 */
export function sanitizeSvg(input: string): string {
  if (typeof input !== "string") return fail("malformed", "expected text");
  if (input.length > MAX_SVG_INPUT_CHARS) fail("tooLarge", "the picture is too large");
  if (hasControl(input, true)) fail("badCharacters", "control characters");
  let source = (input.charCodeAt(0) === 0xfeff ? input.slice(1) : input).trim();
  // The XML header is harmless on its own; any other processing instruction is not.
  source = source.replace(/^<\?xml\s[^>]*\?>/i, "").trim();
  if (/<!doctype|<!entity|<!\[cdata\[/i.test(source))
    fail("forbiddenMarkup", "a declaration, an entity or a CDATA section");
  const root = parse(source);
  const hasViewBox = root.attributes.some(([name]) => name === "viewBox");
  const hasSize =
    root.attributes.some(([name]) => name === "width") &&
    root.attributes.some(([name]) => name === "height");
  if (!hasViewBox && !hasSize) fail("noSize", "the picture has no size");
  const out = write({
    ...root,
    attributes: [["xmlns", "http://www.w3.org/2000/svg"], ...root.attributes],
  });
  if (out.length > MAX_SVG_INPUT_CHARS) fail("tooLarge", "the picture is too large");
  return out;
}
