/**
 * Dragging blocks (issue #593): small pure rules shared by the palette drag and the reorder drag.
 * Dragging is a second way to do what a tap or a key already does, never the only one.
 */
export const DRAG_DISTANCE = 8;
export const TOUCH_HOLD_MS = 250;

export function movedFar(dx: number, dy: number, threshold: number = DRAG_DISTANCE): boolean {
  return Math.hypot(dx, dy) > threshold;
}

/** The place under a pointer: the item whose middle the pointer has not passed, else the last. */
export function dropIndex(
  items: readonly { readonly top: number; readonly height: number }[],
  y: number,
): number {
  if (items.length === 0) return 0;
  const index = items.findIndex((item) => y < item.top + item.height / 2);
  return index === -1 ? items.length - 1 : index;
}

/** A palette button is one that adds a block: its label starts with a plus. */
export function isAddButton(label: string | null | undefined): boolean {
  return (label ?? "").trim().startsWith("+");
}

/** Where a dropped block would be inserted: before the first item whose middle is below the pointer. */
export function insertIndex(
  items: readonly { readonly top: number; readonly height: number }[],
  y: number,
): number {
  const index = items.findIndex((item) => y < item.top + item.height / 2);
  return index === -1 ? items.length : index;
}
