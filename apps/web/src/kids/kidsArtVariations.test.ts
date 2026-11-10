import { describe, expect, it } from "vitest";
import {
  ART_VARIATIONS,
  ART_VARIATION_TEXT,
  applyArtVariation,
  flipPixels,
  isArtVariation,
  mirrorPixels,
  shiftBrightnessPixels,
  shiftHuePixels,
  turnPixels,
} from "./kidsArtVariations.js";

/** A 3 by 3 picture where every pixel is different, so any wrong move shows. */
function picture(): Uint8ClampedArray {
  const data = new Uint8ClampedArray(3 * 3 * 4);
  for (let i = 0; i < 9; i += 1) {
    data[i * 4] = i * 20;
    data[i * 4 + 1] = 200 - i * 10;
    data[i * 4 + 2] = i * 5;
    data[i * 4 + 3] = i % 2 === 0 ? 255 : 128;
  }
  return data;
}
const red = (data: Uint8ClampedArray, x: number, y: number, side = 3) => data[(y * side + x) * 4];

describe("Ori's ideas for a picture (#1308)", () => {
  it("is a closed list with words in both languages", () => {
    for (const idea of ART_VARIATIONS) {
      expect(isArtVariation(idea)).toBe(true);
      expect(ART_VARIATION_TEXT[idea].es.length).toBeGreaterThan(0);
      expect(ART_VARIATION_TEXT[idea].en.length).toBeGreaterThan(0);
    }
    expect(isArtVariation("draw a cat")).toBe(false);
  });

  it("mirrors, flips and turns without losing or inventing a pixel", () => {
    const p = picture();
    const mirrored = mirrorPixels(p, 3);
    expect(red(mirrored, 0, 0)).toBe(red(p, 2, 0));
    expect(red(mirrored, 1, 1)).toBe(red(p, 1, 1));
    expect(mirrorPixels(mirrored, 3)).toEqual(p);
    const flipped = flipPixels(p, 3);
    expect(red(flipped, 0, 0)).toBe(red(p, 0, 2));
    expect(flipPixels(flipped, 3)).toEqual(p);
    const turned = turnPixels(p, 3);
    // The top-left pixel goes to the top-right after a quarter turn clockwise.
    expect(red(turned, 2, 0)).toBe(red(p, 0, 0));
    expect(red(turned, 2, 2)).toBe(red(p, 2, 0));
    expect(red(turned, 0, 0)).toBe(red(p, 0, 2));
    let again = p;
    for (let i = 0; i < 4; i += 1) again = turnPixels(again, 3);
    expect(again).toEqual(p);
    // Same pixels, only moved.
    const sorted = (data: Uint8ClampedArray) =>
      Array.from({ length: 9 }, (_unused, i) => data.slice(i * 4, i * 4 + 4).join()).sort();
    expect(sorted(turned)).toEqual(sorted(p));
  });

  it("changes colours round the wheel and brightness, keeping greys and transparency", () => {
    const red1 = new Uint8ClampedArray([255, 0, 0, 255]);
    const green = shiftHuePixels(red1, 1, 120);
    expect([...green]).toEqual([0, 255, 0, 255]);
    expect([...shiftHuePixels(red1, 1, 360)]).toEqual([255, 0, 0, 255]);
    const grey = new Uint8ClampedArray([120, 120, 120, 90]);
    expect([...shiftHuePixels(grey, 1, 120)]).toEqual([120, 120, 120, 90]);
    expect([...shiftBrightnessPixels(new Uint8ClampedArray([100, 250, 10, 77]), 1, 50)]).toEqual([
      150, 255, 60, 77,
    ]);
    expect([...shiftBrightnessPixels(new Uint8ClampedArray([100, 250, 10, 77]), 1, -50)]).toEqual([
      50, 200, 0, 77,
    ]);
  });

  it("applies every idea to a square picture and refuses one that is not square", () => {
    const p = picture();
    for (const idea of ART_VARIATIONS) {
      const out = applyArtVariation(p, 3, idea);
      expect(out).toHaveLength(p.length);
      expect(out).not.toBe(p);
    }
    expect(() => mirrorPixels(new Uint8ClampedArray(20), 2)).toThrow();
    expect(() => turnPixels(new Uint8ClampedArray(4), 0)).toThrow();
  });
});
