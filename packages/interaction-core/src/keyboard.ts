import type { StatementLocation } from "@agorix/block-editor";
import type { Intent } from "./intents.js";

export type KeyChord = "Alt+ArrowUp" | "Alt+ArrowDown" | "Delete";

export interface FocusedBlock {
  readonly location: StatementLocation;
  readonly siblingCount: number;
}

/** Keyboard equivalents from docs/product/INPUT_PARITY_MATRIX.md; same intents as dragging. */
export function keyboardIntent(chord: KeyChord, focus: FocusedBlock): Intent | undefined {
  const { container, index } = focus.location;
  switch (chord) {
    case "Alt+ArrowUp":
      return index <= 0
        ? undefined
        : { type: "moveBlock", from: focus.location, to: { container, index: index - 1 } };
    case "Alt+ArrowDown":
      return index >= focus.siblingCount - 1
        ? undefined
        : { type: "moveBlock", from: focus.location, to: { container, index: index + 1 } };
    case "Delete":
      return { type: "deleteBlock", location: focus.location };
  }
}
