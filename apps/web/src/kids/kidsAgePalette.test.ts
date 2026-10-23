import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./kids.css", import.meta.url), "utf8");

function tokens(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  expect(start).toBeGreaterThanOrEqual(0);
  const body = css.slice(css.indexOf("{", start) + 1, css.indexOf("}", start));
  return Object.fromEntries(
    [...body.matchAll(/(--kids-[a-z-]+):\s*([^;]+);/g)].map((match) => [
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

const root = tokens(":root");
const palettes = [
  ["6-8", root],
  ["9-12", tokens('.kids-root[data-age-palette="balanced"]')],
  ["13+", tokens('.kids-root[data-age-palette="compact"]')],
] as const;

describe("age band palettes (issue #454)", () => {
  it("preserves the shipped 6–8 tokens", () => {
    expect(root["--kids-canvas"]).toBe("#f7f4ee");
    expect(root["--kids-block-move-bg"]).toBe("#2864c5");
  });

  for (const [band, palette] of palettes) {
    it(`${band} keeps chrome and block labels readable`, () => {
      for (const surface of ["canvas", "panel"] as const) {
        expect(
          contrast(palette[`--kids-${surface}`]!, palette["--kids-text"]!),
        ).toBeGreaterThanOrEqual(4.5);
      }
      expect(
        contrast(palette["--kids-panel"]!, palette["--kids-text-secondary"]!),
      ).toBeGreaterThanOrEqual(4.5);
      for (const category of ["move", "turn", "control", "sound", "event"] as const) {
        expect(
          contrast(
            palette[`--kids-block-${category}-bg`]!,
            palette[`--kids-block-${category}-text`]!,
          ),
        ).toBeGreaterThanOrEqual(4.5);
      }
    });
  }

  it("assigns a distinct token set to each older band", () => {
    expect(palettes.map(([, palette]) => palette["--kids-canvas"])).toEqual([
      "#f7f4ee",
      "#eef4f9",
      "#e9edf2",
    ]);
  });
});
