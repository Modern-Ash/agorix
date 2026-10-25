import { describe, expect, it } from "vitest";
import { floodFill, hexToRgba, pushSnapshot } from "./kidsPaint.js";

function blank(width: number, height: number, rgba = [255, 255, 255, 255]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i += 1) data.set(rgba, i * 4);
  return data;
}

const at = (data: Uint8ClampedArray, width: number, x: number, y: number) =>
  Array.from(data.slice((y * width + x) * 4, (y * width + x) * 4 + 4));

describe("Kids drawing helpers", () => {
  it("parses a hex colour and rejects anything else", () => {
    expect(hexToRgba("#ef627d")).toEqual([239, 98, 125, 255]);
    for (const bad of ["red", "#fff", "#12345g", "url(x)"]) expect(() => hexToRgba(bad)).toThrow();
  });

  it("fills only the connected area and stops at a line", () => {
    const data = blank(6, 4);
    for (let y = 0; y < 4; y += 1) data.set([0, 0, 0, 255], (y * 6 + 3) * 4);
    expect(floodFill(data, 6, 4, 0, 0, [255, 0, 0, 255])).toBe(true);
    expect(at(data, 6, 2, 3)).toEqual([255, 0, 0, 255]);
    expect(at(data, 6, 3, 1)).toEqual([0, 0, 0, 255]);
    expect(at(data, 6, 4, 1)).toEqual([255, 255, 255, 255]);
  });

  it("fills transparent areas and ignores a repeat fill, a miss and bad sizes", () => {
    const data = blank(3, 3, [0, 0, 0, 0]);
    expect(floodFill(data, 3, 3, 1, 1, [0, 255, 0, 255])).toBe(true);
    expect(at(data, 3, 2, 2)).toEqual([0, 255, 0, 255]);
    expect(floodFill(data, 3, 3, 1, 1, [0, 255, 0, 255])).toBe(false);
    expect(floodFill(data, 3, 3, 5, 1, [0, 0, 255, 255])).toBe(false);
    expect(() => floodFill(new Uint8ClampedArray(4), 3, 3, 0, 0, [0, 0, 0, 255])).toThrow();
  });

  it("treats near colours as one area so soft edges leave no halo", () => {
    const data = blank(4, 1);
    data.set([240, 240, 240, 255], 4);
    expect(floodFill(data, 4, 1, 0, 0, [0, 0, 255, 255])).toBe(true);
    expect(at(data, 4, 1, 0)).toEqual([0, 0, 255, 255]);
  });

  it("keeps only the latest snapshots", () => {
    expect(pushSnapshot([1, 2, 3], 4, 3)).toEqual([2, 3, 4]);
  });
});
