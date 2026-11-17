import { describe, expect, it } from "vitest";
import { transformImagePixels } from "./imageTransforms.js";

const pixels = new Uint8ClampedArray([1, 0, 0, 255, 2, 0, 0, 255, 3, 0, 0, 255, 4, 0, 0, 255]);

const redChannels = (data: Uint8ClampedArray) => [data[0], data[4], data[8], data[12]];

describe("Studio image transforms", () => {
  it("flips a draft horizontally without changing its source pixels", () => {
    expect(redChannels(transformImagePixels(pixels, 2, 2, "flipHorizontal"))).toEqual([2, 1, 4, 3]);
    expect(redChannels(pixels)).toEqual([1, 2, 3, 4]);
  });

  it("rotates a draft half a turn and rejects malformed dimensions", () => {
    expect(redChannels(transformImagePixels(pixels, 2, 2, "rotateHalfTurn"))).toEqual([4, 3, 2, 1]);
    expect(() => transformImagePixels(pixels, 0, 2, "flipHorizontal")).toThrow(RangeError);
    expect(() => transformImagePixels(pixels, 3, 2, "flipHorizontal")).toThrow(RangeError);
  });
});
