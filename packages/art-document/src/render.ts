import { ART_KINDS, type ArtColor, type ArtDocument, type ArtShape } from "./document.js";

/** Text can hold letters, digits and spaces only, but escaping keeps the rule here too. */
function escapeText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const paint = (value: ArtColor | null): string => (value === null ? "none" : value);

function shapeSvg(shape: ArtShape): string {
  switch (shape.type) {
    case "rect":
      return `<rect x="${shape.x}" y="${shape.y}" width="${shape.width}" height="${shape.height}" fill="${paint(shape.fill)}" stroke="${paint(shape.stroke)}" stroke-width="${shape.strokeWidth}"/>`;
    case "ellipse":
      return `<ellipse cx="${shape.cx}" cy="${shape.cy}" rx="${shape.rx}" ry="${shape.ry}" fill="${paint(shape.fill)}" stroke="${paint(shape.stroke)}" stroke-width="${shape.strokeWidth}"/>`;
    case "line":
      return `<line x1="${shape.x1}" y1="${shape.y1}" x2="${shape.x2}" y2="${shape.y2}" stroke="${shape.stroke}" stroke-width="${shape.strokeWidth}" stroke-linecap="round"/>`;
    case "stroke":
      return `<polyline points="${shape.points.map(([x, y]) => `${x},${y}`).join(" ")}" fill="none" stroke="${shape.stroke}" stroke-width="${shape.strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>`;
    case "text":
      return `<text x="${shape.x}" y="${shape.y}" font-size="${shape.size}" font-family="sans-serif" fill="${shape.fill}">${escapeText(shape.text)}</text>`;
    case "bitmap":
      return `<image x="${shape.x}" y="${shape.y}" width="${shape.width}" height="${shape.height}" href="${shape.source}"/>`;
  }
}

/**
 * The picture as SVG. A document is validated before it gets here; every number in the markup is
 * a whole number from the document, every colour one of the palette, every piece of text escaped,
 * and the only link is a bounded PNG or WebP the document itself carries.
 */
export function renderArtDocumentSvg(
  document: ArtDocument,
  options: { title?: string } = {},
): string {
  const { width, height } = ART_KINDS[document.kind];
  const title = options.title === undefined ? "" : `<title>${escapeText(options.title)}</title>`;
  const background =
    document.background === null
      ? ""
      : `<rect x="0" y="0" width="${width}" height="${height}" fill="${document.background}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img">${title}${background}${document.shapes.map(shapeSvg).join("")}</svg>`;
}
