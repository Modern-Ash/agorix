import type { ExtensionId, Statement } from "@agorix/program-model";
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
  stop: "logic",
  askChoice: "logic",
  setVolume: "media",
  changeVolume: "media",
  repeat: "logic",
  repeatUntil: "logic",
  forever: "logic",
  waitUntil: "logic",
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

/**
 * Starters that appear once the child has used the concept before them (issue #1133). The shelf
 * only grows: the whole palette below it is never hidden, so this is a nudge, not a gate.
 */
export const STUDIO_STARTER_UNLOCKS = [
  { kind: "repeat", after: "move" },
  { kind: "wait", after: "playSound" },
] as const satisfies readonly { readonly kind: StudioBlockKind; readonly after: StudioBlockKind }[];

export type StudioStarterKind =
  (typeof STUDIO_STARTER_BLOCKS)[number] | (typeof STUDIO_STARTER_UNLOCKS)[number]["kind"];

/** Block kinds used anywhere in a script, including loop and branch bodies. */
export function usedBlockKinds(statements: readonly Statement[]): ReadonlySet<string> {
  const used = new Set<string>();
  const visit = (list: readonly Statement[]) => {
    for (const statement of list) {
      used.add(statement.type);
      if ("body" in statement) visit(statement.body);
      if ("then" in statement) visit(statement.then);
      if ("else" in statement && statement.else) visit(statement.else);
    }
  };
  visit(statements);
  return used;
}

/** The base starters plus the ones the child has earned by using the concept before them. */
export function starterShelf(statements: readonly Statement[]): readonly StudioStarterKind[] {
  const used = usedBlockKinds(statements);
  return [
    ...STUDIO_STARTER_BLOCKS,
    ...STUDIO_STARTER_UNLOCKS.filter((unlock) => used.has(unlock.after)).map(
      (unlock) => unlock.kind,
    ),
  ];
}

/** The block a starter adds; values are ones the free scene accepts (see `kidsStudioModel`). */
export function starterStatement(kind: StudioStarterKind, soundId: string): StudioStatement {
  switch (kind) {
    case "move":
      return { type: "move", steps: 40 };
    case "turn":
      return { type: "turn", degrees: 90 };
    case "playSound":
      return { type: "playSound", soundId };
    case "repeat":
      return { type: "repeat", count: 3, body: [{ type: "move", steps: 40 }] };
    case "wait":
      return { type: "wait", seconds: 1 };
  }
}
