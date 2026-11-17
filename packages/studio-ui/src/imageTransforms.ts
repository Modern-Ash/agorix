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

/** Fill one connected region of a bounded draft image; leave the input untouched. */
export function fillImageRegion(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  hexColor: string,
): Uint8ClampedArray | undefined {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    data.length !== width * height * 4 ||
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !/^#[0-9a-fA-F]{6}$/.test(hexColor)
  )
    return undefined;
  const startX = Math.floor(x);
  const startY = Math.floor(y);
  if (startX < 0 || startY < 0 || startX >= width || startY >= height) return undefined;
  const color = [
    Number.parseInt(hexColor.slice(1, 3), 16),
    Number.parseInt(hexColor.slice(3, 5), 16),
    Number.parseInt(hexColor.slice(5, 7), 16),
    255,
  ];
  const start = startY * width + startX;
  const original = Array.from(data.subarray(start * 4, start * 4 + 4));
  if (original.every((channel, index) => channel === color[index])) return undefined;
  const result = new Uint8ClampedArray(data);
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;
  queue[tail++] = start;
  visited[start] = 1;
  while (head < tail) {
    const pixel = queue[head++]!;
    const offset = pixel * 4;
    if (!original.every((channel, index) => result[offset + index] === channel)) continue;
    result.set(color, offset);
    const px = pixel % width;
    const py = Math.floor(pixel / width);
    for (const next of [
      px > 0 ? pixel - 1 : -1,
      px + 1 < width ? pixel + 1 : -1,
      py > 0 ? pixel - width : -1,
      py + 1 < height ? pixel + width : -1,
    ]) {
      if (next >= 0 && visited[next] === 0) {
        visited[next] = 1;
        queue[tail++] = next;
      }
    }
  }
  return result;
}
