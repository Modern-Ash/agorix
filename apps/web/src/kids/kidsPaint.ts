/** Pure pixel helpers for the Kids drawing canvas, kept apart from the DOM so they can be tested. */

export type Rgba = readonly [number, number, number, number];

export function hexToRgba(hex: string): Rgba {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) throw new RangeError("invalid color");
  return [parseInt(match[1]!, 16), parseInt(match[2]!, 16), parseInt(match[3]!, 16), 255];
}

const TOLERANCE = 48;

function close(data: Uint8ClampedArray, offset: number, target: Rgba): boolean {
  return (
    Math.abs(data[offset]! - target[0]) <= TOLERANCE &&
    Math.abs(data[offset + 1]! - target[1]) <= TOLERANCE &&
    Math.abs(data[offset + 2]! - target[2]) <= TOLERANCE &&
    Math.abs(data[offset + 3]! - target[3]) <= TOLERANCE
  );
}

/**
 * Paint the connected area around a point, like a bucket. Colours within a small tolerance of the
 * clicked one count as the same area, so soft brush edges fill without a halo. Work is bounded by
 * the number of pixels. Returns false when the area already has that colour.
 */
export function floodFill(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  paint: Rgba,
): boolean {
  if (data.length !== width * height * 4) throw new RangeError("invalid image data");
  const startX = Math.floor(x);
  const startY = Math.floor(y);
  if (startX < 0 || startY < 0 || startX >= width || startY >= height) return false;
  const origin = (startY * width + startX) * 4;
  const target: Rgba = [data[origin]!, data[origin + 1]!, data[origin + 2]!, data[origin + 3]!];
  if (
    target[0] === paint[0] &&
    target[1] === paint[1] &&
    target[2] === paint[2] &&
    target[3] === paint[3]
  )
    return false;
  const seen = new Uint8Array(width * height);
  const stack = [startX, startY];
  while (stack.length > 0) {
    const cy = stack.pop()!;
    const cx = stack.pop()!;
    const index = cy * width + cx;
    if (seen[index] || !close(data, index * 4, target)) continue;
    seen[index] = 1;
    data[index * 4] = paint[0];
    data[index * 4 + 1] = paint[1];
    data[index * 4 + 2] = paint[2];
    data[index * 4 + 3] = paint[3];
    if (cx > 0) stack.push(cx - 1, cy);
    if (cx < width - 1) stack.push(cx + 1, cy);
    if (cy > 0) stack.push(cx, cy - 1);
    if (cy < height - 1) stack.push(cx, cy + 1);
  }
  return true;
}

/** Keep the most recent snapshots only, so undo never grows without bound. */
export function pushSnapshot<T>(stack: readonly T[], snapshot: T, max: number): T[] {
  return [...stack, snapshot].slice(-max);
}
