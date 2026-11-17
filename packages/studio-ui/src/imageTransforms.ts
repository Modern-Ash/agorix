/** Pixel transforms stay local to the draft canvas until the learner saves an image asset. */
export function transformImagePixels(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  kind: "flipHorizontal" | "rotateHalfTurn",
): Uint8ClampedArray {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    data.length !== width * height * 4
  )
    throw new RangeError("Invalid image dimensions");
  const transformed = new Uint8ClampedArray(data.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const targetX = width - 1 - x;
      const targetY = kind === "rotateHalfTurn" ? height - 1 - y : y;
      const from = (y * width + x) * 4;
      const to = (targetY * width + targetX) * 4;
      transformed.set(data.subarray(from, from + 4), to);
    }
  }
  return transformed;
}
