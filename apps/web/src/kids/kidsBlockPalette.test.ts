import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Issue #447: block colours are tokens; both palettes keep readable text (WCAG AA, 4.5:1).
const css = readFileSync(new URL("./kids.css", import.meta.url), "utf8");

function block(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  expect(start).toBeGreaterThanOrEqual(0);
  const body = css.slice(css.indexOf("{", start) + 1, css.indexOf("}", start));
  return Object.fromEntries(
    [...body.matchAll(/(--kids-block-[a-z-]+):\s*([^;]+);/g)].map((match) => [
      match[1]!,
      match[2]!.trim(),
    ]),
  );
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255);
  const [r, g, b] = channels.map((value) =>
    value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  ) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const categories = ["move", "turn", "control", "sound", "event", "looks"] as const;
const defaults = block(":root");
const scratch = block('.kids-root[data-block-palette="scratch"]');

describe("block category tokens (issue #447)", () => {
  it("keeps the shipped colours as the default palette", () => {
    expect(defaults["--kids-block-move-bg"]).toBe("#2864c5");
    expect(defaults["--kids-block-turn-bg"]).toBe("#6942b7");
    expect(defaults["--kids-block-control-bg"]).toBe("#7042b8");
    expect(defaults["--kids-block-sound-bg"]).toBe("#ad5c12");
    expect(defaults["--kids-block-event-bg"]).toBe("#f8c573");
    expect(defaults["--kids-block-event-text"]).toBe("#3d2203");
    expect(defaults["--kids-block-looks-bg"]).toBe("#7b3fa0");
    expect(defaults["--kids-block-looks-text"]).toBe("#ffffff");
  });

  it("defines the Scratch hues from the prototype", () => {
    expect(scratch["--kids-block-move-bg"]).toBe("#4c97ff");
    expect(scratch["--kids-block-move-border"]).toBe("#3373cc");
    expect(scratch["--kids-block-control-bg"]).toBe("#ffab19");
    expect(scratch["--kids-block-control-border"]).toBe("#cf8b17");
    expect(scratch["--kids-block-sound-bg"]).toBe("#cf63cf");
    expect(scratch["--kids-block-sound-border"]).toBe("#bd42bd");
    expect(scratch["--kids-block-event-bg"]).toBe("#ffbf00");
    expect(scratch["--kids-block-event-border"]).toBe("#cc9900");
    expect(scratch["--kids-block-looks-bg"]).toBe("#9966ff");
    expect(scratch["--kids-block-looks-border"]).toBe("#774dcb");
  });

  for (const [name, tokens] of [
    ["default", defaults],
    ["scratch", scratch],
  ] as const) {
    for (const category of categories) {
      it(`${name} ${category}: text reaches 4.5:1 on its background`, () => {
        const bg = tokens[`--kids-block-${category}-bg`]!;
        const text = tokens[`--kids-block-${category}-text`]!;
        expect(contrast(bg, text)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  it("components use tokens, not hard-coded block hexes", () => {
    for (const hex of ["#2864c5", "#6942b7", "#7042b8", "#ad5c12", "#7b3fa0"]) {
      const uses = css.split(hex).length - 1;
      expect(uses).toBe(1); // only the :root definition
    }
  });

  it("maps the snap-together palette tools to their category tokens", () => {
    expect(css).toContain("--kids-palette-tool-bg: var(--kids-block-looks-bg)");
    expect(css).toContain("--kids-palette-tool-bg: var(--kids-block-move-bg)");
    expect(css).toContain("--kids-palette-tool-bg: var(--kids-block-sound-bg)");
    expect(css).toContain("--kids-palette-tool-bg: var(--kids-block-control-bg)");
  });
});
