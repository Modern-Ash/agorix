import type { ExtensionId } from "@agorix/program-model";
import type { StudioCategory } from "./kidsStudioCategories.js";
import type { StudioStatement } from "./kidsStudioModel.js";

export type StudioBlockKind = StudioStatement["type"];

/**
 * The palette category of every block the free scene offers (issues #1110, #1121). One entry per
 * statement kind and exhaustive, so a block added to `StudioStatement` does not compile until it
 * is given a place. The palette JSX in `KidsStudioScreen` follows this order; a curated "for
 * starters" shelf and mission subsets are meant to be views over this table, not second lists.
 */
export const STUDIO_BLOCK_CATEGORY = {
  say: "looks",
  think: "looks",
  show: "looks",
  hide: "looks",
  setSize: "looks",
  changeSize: "looks",
  setEffect: "looks",
  changeEffect: "looks",
  clearEffects: "looks",
  wait: "looks",
  move: "motion",
  goTo: "motion",
  glideTo: "motion",
  turn: "motion",
  pointInDirection: "motion",
  pointTowards: "motion",
  bounceOnEdge: "motion",
  goToLayer: "motion",
  switchCostume: "media",
  switchBackdrop: "media",
  playSound: "media",
  stopSounds: "media",
  setVolume: "media",
  changeVolume: "media",
  repeat: "logic",
  repeatUntil: "logic",
  if: "logic",
  broadcast: "logic",
  callProcedure: "myBlocks",
  penDown: "pen",
  penUp: "pen",
  setPenColor: "pen",
  setPenSize: "pen",
  clearPen: "pen",
  playNote: "music",
  playDrum: "music",
  setInstrument: "music",
  setTempo: "music",
  setPitch: "music",
  setPan: "music",
  setVariable: "data",
  changeVariable: "data",
  showVariable: "data",
  hideVariable: "data",
  listAdd: "data",
  listRemoveAt: "data",
  listInsertAt: "data",
  listReplaceAt: "data",
} as const satisfies Record<StudioBlockKind, StudioCategory>;

/** The extension pack a block needs, if any: only the Pen and Music categories are packs. */
export function extensionOfBlock(kind: StudioBlockKind): ExtensionId | undefined {
  const category: StudioCategory = STUDIO_BLOCK_CATEGORY[kind];
  return category === "pen" || category === "music" ? category : undefined;
}

export function blocksInCategory(category: StudioCategory): readonly StudioBlockKind[] {
  return (Object.keys(STUDIO_BLOCK_CATEGORY) as StudioBlockKind[]).filter(
    (kind) => STUDIO_BLOCK_CATEGORY[kind] === category,
  );
}

/** The shelf a child sees first in Escena libre: three blocks that already make a program. */
export const STUDIO_STARTER_BLOCKS = [
  "move",
  "turn",
  "playSound",
] as const satisfies readonly StudioBlockKind[];

export type StudioStarterKind = (typeof STUDIO_STARTER_BLOCKS)[number];

/** The block a starter adds; values are ones the free scene accepts (see `kidsStudioModel`). */
export function starterStatement(kind: StudioStarterKind, soundId: string): StudioStatement {
  switch (kind) {
    case "move":
      return { type: "move", steps: 40 };
    case "turn":
      return { type: "turn", degrees: 90 };
    case "playSound":
      return { type: "playSound", soundId };
  }
}
