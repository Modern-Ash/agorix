export const ZOOM_LEVELS = [80, 100, 125, 150] as const;
export type ZoomLevel = (typeof ZOOM_LEVELS)[number];

export function nextZoom(current: ZoomLevel, direction: -1 | 1): ZoomLevel {
  const index = ZOOM_LEVELS.indexOf(current);
  return ZOOM_LEVELS[Math.max(0, Math.min(ZOOM_LEVELS.length - 1, index + direction))]!;
}

/** Browser client coordinates and block offsets are normalized to the same zoomed space. */
export function dropSlot(
  clientY: number,
  listTop: number,
  blockMidpoints: readonly number[],
  zoom: ZoomLevel,
): number {
  const y = (clientY - listTop) / (zoom / 100);
  return blockMidpoints.findIndex((midpoint) => y < midpoint) < 0
    ? blockMidpoints.length
    : blockMidpoints.findIndex((midpoint) => y < midpoint);
}
