import { describe, expect, it } from "vitest";
import {
  ArtDocumentError,
  MAX_ART_SHAPES,
  MAX_SVG_INPUT_CHARS,
  SvgSanitizeError,
  createArtDocument,
  describeArtDocument,
  renderArtDocumentSvg,
  sanitizeSvg,
  validateArtDocument,
  type ArtDocument,
} from "./index.js";

const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

const house: ArtDocument = {
  schema: "agorix/art-document/v1",
  kind: "costume",
  background: "#a5d8ff",
  shapes: [
    {
      id: "s1",
      type: "rect",
      x: 60,
      y: 100,
      width: 120,
      height: 100,
      fill: "#f08c00",
      stroke: "#000000",
      strokeWidth: 2,
    },
    {
      id: "s2",
      type: "ellipse",
      cx: 120,
      cy: 60,
      rx: 40,
      ry: 30,
      fill: "#e03131",
      stroke: null,
      strokeWidth: 1,
    },
    { id: "s3", type: "line", x1: 0, y1: 220, x2: 240, y2: 220, stroke: "#2f9e44", strokeWidth: 8 },
    {
      id: "s4",
      type: "stroke",
      points: [
        [10, 10],
        [40, 30],
        [70, 12],
      ],
      stroke: "#7048e8",
      strokeWidth: 4,
    },
    { id: "s5", type: "text", x: 80, y: 150, text: "Hola mundo", size: 24, fill: "#000000" },
  ],
};

const refuses = (value: unknown, code?: string) => {
  try {
    validateArtDocument(value);
  } catch (error) {
    expect(error).toBeInstanceOf(ArtDocumentError);
    if (code) expect((error as ArtDocumentError).code).toBe(code);
    return;
  }
  throw new Error("expected the document to be refused");
};

describe("art document", () => {
  it("accepts a whole drawing and gives it back unchanged, as plain data", () => {
    expect(validateArtDocument(house)).toEqual(house);
    expect(JSON.parse(JSON.stringify(validateArtDocument(house)))).toEqual(house);
    expect(validateArtDocument(createArtDocument("backdrop")).shapes).toEqual([]);
  });

  it("refuses what is outside the palette, the widths, the canvas and the caps", () => {
    const at = (patch: Record<string, unknown>) => ({
      ...house,
      shapes: [{ ...house.shapes[0]!, ...patch }],
    });
    refuses(at({ fill: "#123456" }), "INVALID_FIELD");
    refuses(at({ fill: "red" }), "INVALID_FIELD");
    refuses(at({ strokeWidth: 3 }), "INVALID_FIELD");
    refuses(at({ x: 1.5 }), "INVALID_FIELD");
    refuses(at({ x: -1 }), "OUT_OF_BOUNDS");
    refuses(at({ x: 241 }), "OUT_OF_BOUNDS");
    refuses(at({ width: 0 }), "OUT_OF_BOUNDS");
    refuses(at({ extra: 1 }), "UNKNOWN_FIELD");
    refuses(at({ id: "x1" }), "INVALID_FIELD");
    refuses({ ...house, kind: "poster" }, "INVALID_FIELD");
    refuses({ ...house, schema: "agorix/art-document/v2" }, "INVALID_ROOT");
    refuses({ ...house, shapes: [house.shapes[0], house.shapes[0]] }, "DUPLICATE_ID");
    refuses(
      {
        ...house,
        shapes: Array.from({ length: MAX_ART_SHAPES + 1 }, (_unused, i) => ({
          ...house.shapes[0]!,
          id: `s${i + 1}`,
        })),
      },
      "TOO_MANY",
    );
    refuses(null, "INVALID_ROOT");
  });

  it("limits a free stroke and a text, and a text is only letters, digits and spaces", () => {
    const stroke = (points: unknown) => ({
      ...house,
      shapes: [{ id: "s1", type: "stroke", points, stroke: "#000000", strokeWidth: 2 }],
    });
    refuses(stroke([[1, 1]]), "INVALID_FIELD");
    refuses(stroke(Array.from({ length: 65 }, () => [1, 1])), "TOO_MANY");
    const text = (value: string) => ({
      ...house,
      shapes: [{ id: "s1", type: "text", x: 1, y: 1, text: value, size: 16, fill: "#000000" }],
    });
    refuses(text("<script>"), "INVALID_FIELD");
    refuses(text("a".repeat(21)), "OUT_OF_BOUNDS");
    refuses(text(""), "INVALID_FIELD");
    refuses(text("ok\nline"), "INVALID_FIELD");
    expect(validateArtDocument(text("Árbol 2")).shapes).toHaveLength(1);
  });

  it("takes a picture only as a bounded PNG or WebP, and at most two", () => {
    const bitmap = (id: string, source: string) => ({
      id,
      type: "bitmap",
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      source,
    });
    expect(validateArtDocument({ ...house, shapes: [bitmap("s1", PNG)] }).shapes).toHaveLength(1);
    refuses({ ...house, shapes: [bitmap("s1", "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=")] });
    refuses({ ...house, shapes: [bitmap("s1", "https://example.com/a.png")] });
    refuses({ ...house, shapes: [bitmap("s1", "data:image/png;base64,AAAA")] });
    refuses(
      { ...house, shapes: [bitmap("s1", PNG), bitmap("s2", PNG), bitmap("s3", PNG)] },
      "TOO_MANY",
    );
  });

  it("renders only numbers, palette colours and escaped text, so a document never carries markup", () => {
    const svg = renderArtDocumentSvg(house, { title: 'Casa <b>"1"' });
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240"')).toBe(
      true,
    );
    expect(svg).toContain('fill="#f08c00"');
    expect(svg).toContain("<title>Casa &lt;b&gt;&quot;1&quot;</title>");
    expect(svg).toContain(">Hola mundo</text>");
    expect(svg).toBe(renderArtDocumentSvg(house, { title: 'Casa <b>"1"' }));
    // The output of the renderer is itself accepted by the sanitiser unchanged in meaning.
    expect(sanitizeSvg(svg)).toContain("<rect");
    expect(
      renderArtDocumentSvg({
        ...house,
        shapes: [{ id: "s1", type: "bitmap", x: 0, y: 0, width: 4, height: 4, source: PNG }],
      }),
    ).toContain(`href="${PNG}"`);
  });

  it("describes the picture in words, in both languages, from the shapes alone", () => {
    expect(describeArtDocument(house, "es")).toBe(
      "Un disfraz con fondo celeste, con 5 formas: un rectángulo naranja, una elipse rojo, una línea verde, un trazo violeta y el texto «Hola mundo».",
    );
    expect(describeArtDocument(createArtDocument("backdrop"), "en")).toBe("A backdrop, empty.");
    expect(
      describeArtDocument({ ...house, background: null, shapes: [house.shapes[2]!] }, "en"),
    ).toBe("A costume, with 1 shape: a green line.");
  });
});

/** Pictures built to make a viewer run code, load something or hang. Each must be refused. */
const HOSTILE: readonly [string, string][] = [
  ["script element", '<svg viewBox="0 0 10 10"><script>alert(1)</script></svg>'],
  ["script in any case", '<svg viewBox="0 0 10 10"><ScRiPt>alert(1)</sCrIpT></svg>'],
  ["onload handler", '<svg viewBox="0 0 10 10" onload="alert(1)"></svg>'],
  [
    "handler on a shape",
    '<svg viewBox="0 0 10 10"><rect width="1" height="1" onclick="x()"/></svg>',
  ],
  ["slash instead of space", '<svg/onload=alert(1) viewBox="0 0 1 1"></svg>'],
  ["foreignObject", '<svg viewBox="0 0 10 10"><foreignObject><div>x</div></foreignObject></svg>'],
  [
    "use of an external file",
    '<svg viewBox="0 0 10 10"><use href="http://evil.test/a.svg#x"/></svg>',
  ],
  ["use with xlink", '<svg viewBox="0 0 10 10"><use xlink:href="data:text/xml,x"/></svg>'],
  ["image element", '<svg viewBox="0 0 10 10"><image href="https://evil.test/p.png"/></svg>'],
  ["link", '<svg viewBox="0 0 10 10"><a href="javascript:alert(1)"><text>x</text></a></svg>'],
  [
    "href on a shape",
    '<svg viewBox="0 0 10 10"><rect href="javascript:alert(1)" width="1" height="1"/></svg>',
  ],
  [
    "style element with an import",
    '<svg viewBox="0 0 10 10"><style>@import url(http://evil.test/x.css);</style></svg>',
  ],
  [
    "style attribute with a url",
    '<svg viewBox="0 0 10 10"><rect width="1" height="1" style="fill:url(http://evil.test/#a)"/></svg>',
  ],
  ["fill with a url", '<svg viewBox="0 0 10 10"><rect width="1" height="1" fill="url(#a)"/></svg>'],
  [
    "animation that sets a link",
    '<svg viewBox="0 0 10 10"><a><set attributeName="href" to="javascript:alert(1)"/></a></svg>',
  ],
  [
    "animate with a handler",
    '<svg viewBox="0 0 10 10"><rect width="1" height="1"><animate onbegin="alert(1)" attributeName="x"/></rect></svg>',
  ],
  [
    "entity declaration",
    '<!DOCTYPE svg [<!ENTITY x "boom">]><svg viewBox="0 0 10 10"><text>&x;</text></svg>',
  ],
  [
    "billion laughs",
    '<!DOCTYPE svg [<!ENTITY a "aaaa"><!ENTITY b "&a;&a;&a;&a;">]><svg viewBox="0 0 1 1"><text>&b;</text></svg>',
  ],
  ["character reference", '<svg viewBox="0 0 10 10"><text>&#106;avascript:</text></svg>'],
  ["CDATA", '<svg viewBox="0 0 10 10"><text><![CDATA[<script>]]></text></svg>'],
  [
    "stylesheet instruction",
    '<?xml-stylesheet href="http://evil.test/x.css"?><svg viewBox="0 0 10 10"></svg>',
  ],
  ["html around it", '<html><body><svg viewBox="0 0 10 10"></svg></body></html>'],
  ["null byte", '<svg viewBox="0 0 10 10"><text>a\u0000b</text></svg>'],
  ["unquoted attribute", "<svg viewBox=0010><rect width=1 height=1 /></svg>"],
  [
    "comment hiding a tag",
    '<svg viewBox="0 0 10 10"><!-- <script>alert(1)</script> --><script>alert(2)</script></svg>',
  ],
  ["a comment that never ends", '<svg viewBox="0 0 10 10"><!-- <script>alert(1)</script></svg>'],
  ["two pictures", '<svg viewBox="0 0 1 1"></svg><svg viewBox="0 0 1 1"></svg>'],
  ["tags that do not match", '<svg viewBox="0 0 10 10"><g></svg></g>'],
  ["a number that is not one", '<svg viewBox="0 0 10 10"><rect width="1e9999" height="1"/></svg>'],
  ["a path that is not a path", '<svg viewBox="0 0 10 10"><path d="M0 0 <script>"/></svg>'],
  [
    "a transform that calls out",
    '<svg viewBox="0 0 10 10"><g transform="translate(1) url(#x)"/></svg>',
  ],
  ["no size", '<svg><rect width="1" height="1"/></svg>'],
  ["not a picture", "hello"],
  ["empty", ""],
  ["too deep", `<svg viewBox="0 0 1 1">${"<g>".repeat(30)}${"</g>".repeat(30)}</svg>`],
  [
    "too many elements",
    `<svg viewBox="0 0 1 1">${'<rect width="1" height="1"/>'.repeat(500)}</svg>`,
  ],
  ["too large", `<svg viewBox="0 0 1 1"><text>${"a".repeat(MAX_SVG_INPUT_CHARS)}</text></svg>`],
  [
    "far too many attributes",
    `<svg viewBox="0 0 1 1"><rect ${Array.from({ length: 40 }, (_unused, i) => `x${i}="1"`).join(" ")}/></svg>`,
  ],
];

describe("SVG sanitiser: hostile pictures", () => {
  for (const [label, source] of HOSTILE)
    it(`refuses ${label}`, () => {
      expect(() => sanitizeSvg(source)).toThrow(SvgSanitizeError);
    });

  it("never lets a dangerous word reach the output, whatever the input dresses it as", () => {
    // Pictures that are accepted (the dangerous parts are not understood, so they are not kept).
    const accepted = [
      '<svg viewBox="0 0 10 10" id="x" class="y" data-onload="alert(1)" xmlns:evil="http://evil.test"><rect width="1" height="1" data-x="1"/></svg>',
      '<svg viewBox="0 0 10 10"><rect width="4" height="4" style="fill:red;behavior:url(x);stroke:#000"/></svg>',
      '<svg viewBox="0 0 10 10"><text x="1" y="1">&lt;script&gt;</text></svg>',
    ];
    for (const source of accepted) {
      const out = sanitizeSvg(source);
      expect(out).not.toMatch(/<script|<style|<use|<image|<foreignobject|<!|<\?/i);
      expect(out).not.toMatch(/\son[a-z]+=/i);
      expect(out).not.toMatch(/href|xlink|javascript:|url\(|@import|data-|id=|class=|xmlns:/i);
      // It is a well-formed picture of the same kind: sanitising it again changes nothing.
      expect(sanitizeSvg(out)).toBe(out);
    }
    expect(sanitizeSvg(accepted[1]!)).toContain('fill="red"');
    expect(sanitizeSvg(accepted[1]!)).toContain('stroke="#000"');
    expect(sanitizeSvg(accepted[1]!)).not.toContain("behavior");
    // Text from the picture comes out escaped.
    expect(sanitizeSvg(accepted[2]!)).toContain("&lt;script&gt;");
    // Words inside a text are only text: they are escaped and never become markup.
    const words = sanitizeSvg(
      '<svg viewBox="0 0 10 10"><title>onload=alert(1) javascript: url(x)</title></svg>',
    );
    expect(words.replace(/<title>[^<]*<\/title>/, "")).not.toMatch(/javascript|url\(|onload/i);
  });

  it("keeps an honest picture, rebuilt from what was understood", () => {
    const out = sanitizeSvg(
      '<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="100" height="80" viewBox="0 0 100 80"><g fill="#fcc419" stroke="black" stroke-width="2"><circle cx="50" cy="40" r="30"/><path d="M10 10 L90 10 Z"/></g><text x="5" y="75" font-size="12" font-family="sans-serif">Sol</text></svg>',
    );
    expect(out).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="80" viewBox="0 0 100 80"><g fill="#fcc419" stroke="black" stroke-width="2"><circle cx="50" cy="40" r="30"/><path d="M10 10 L90 10 Z"/></g><text x="5" y="75" font-size="12" font-family="sans-serif">Sol</text></svg>',
    );
  });
});
