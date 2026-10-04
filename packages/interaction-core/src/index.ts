/** Pure drag/keyboard intents and agent anchors shared by Web and Studio. No DOM, no VS Code. */
export const PACKAGE_NAME = "@agorix/interaction-core";

export type { AgentAnchorRef, AnchorKind } from "./anchors.js";
export {
  ANCHOR_KINDS,
  createAnchorRef,
  isAnchorKind,
  isSafeId,
  parseAnchorRef,
} from "./anchors.js";
export type { AgentVerb, DragSource, DropTarget, InsertionPoint, Intent } from "./intents.js";
export { intentToChange, resolveDrop } from "./intents.js";
export type { FocusedBlock, KeyChord } from "./keyboard.js";
export { keyboardIntent } from "./keyboard.js";
