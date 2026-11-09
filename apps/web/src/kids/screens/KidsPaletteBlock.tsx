import { createContext, useContext, type ReactNode } from "react";
import type { StudioBlockKind } from "../kidsPaletteCatalog.js";

/**
 * Dependencies between blocks (#1235): the screen says which blocks have an unmet need and shows
 * the reason when one is tapped. Without a provider every block is available.
 */
export interface PaletteRules {
  /** The hint for a block that is not ready yet, or `undefined` when it can be added. */
  readonly unmetFor: (block: StudioBlockKind) => string | undefined;
  readonly onBlocked: (hint: string) => void;
}
export const PaletteRulesContext = createContext<PaletteRules | null>(null);

/** Block-shaped palette tools. Looks, Motion, Media and Logic are migrated. */
export type KidsPaletteTone = "looks" | "motion" | "sound" | "control";

export interface KidsPaletteAction {
  readonly label: string;
  readonly onAdd: () => void;
  /** The engine block this action adds, so the palette can be checked against the catalog (#1133). */
  readonly block?: StudioBlockKind;
  readonly disabled?: boolean;
  /**
   * `add` (the default) adds a block and can start a drag. `tool` shares the block's
   * values but does not add anything (sound preview, group the last blocks), so it must
   * stay out of the drag path.
   */
  readonly kind?: "add" | "tool";
}

/**
 * One snap-together block in the free-scene palette.
 *
 * The block is a group, not a button: a native button adds the block and native values
 * (selects, inputs) stay inside the same shape. That keeps the keyboard path and the
 * closed value lists while the visible form row disappears. Actions that share a value
 * slot (`say`/`think`, `move`/`move backward`, sound preview/play, repeat/group) live in
 * the same block, as the old form did.
 */
/** A small picture for each kind of block, so a tile reads at a glance (#1110). */
const GLYPH: Partial<Record<string, string>> = {
  move: "➜",
  goTo: "⌖",
  goToTarget: "🎲",
  createCopies: "👯",
  resetTimer: "⏱️",
  stamp: "🖨️",
  setText: "🔤",
  nextCostume: "👗",
  setRotationStyle: "🔄",
  setX: "⇤",
  setY: "⇥",
  changeX: "↔",
  changeY: "↕",
  glideTo: "⇝",
  turn: "↻",
  pointInDirection: "🧭",
  pointTowards: "🎯",
  bounceOnEdge: "⤾",
  say: "💬",
  think: "💭",
  show: "👁",
  hide: "🙈",
  setSize: "⤢",
  changeSize: "⤢",
  waitSeconds: "⏱",
  switchCostume: "👕",
  switchBackdrop: "🖼",
  playSound: "♪",
  stopSounds: "🔇",
  setVolume: "🔊",
  changeVolume: "🔊",
  repeat: "⟳",
  forever: "∞",
  stop: "⏹",
  broadcast: "📣",
  askChoice: "❓",
  setEffect: "✨",
  changeEffect: "✨",
  clearEffects: "✨",
};
const TONE_GLYPH: Record<KidsPaletteTone, string> = {
  motion: "➜",
  looks: "✦",
  sound: "♪",
  control: "⟳",
};

export function KidsPaletteBlock({
  actions,
  tone,
  children,
}: {
  readonly actions: readonly KidsPaletteAction[];
  readonly tone: KidsPaletteTone;
  readonly children?: ReactNode;
}) {
  const rules = useContext(PaletteRulesContext);
  return (
    <div className={`kids-palette-tool kids-palette-tool-${tone}`} data-kids-palette-tool={tone}>
      <span className="kids-palette-tool-actions">
        {actions.map((action) => {
          const adds = action.kind !== "tool";
          const unmet = adds && action.block ? rules?.unmetFor(action.block) : undefined;
          return (
            <button
              key={action.label}
              type="button"
              className="kids-palette-tool-add"
              data-kids-palette-action={adds ? "add" : "tool"}
              data-kids-block={adds ? action.block : undefined}
              data-kids-add={adds && unmet === undefined ? "true" : undefined}
              data-kids-unmet={unmet === undefined ? undefined : "true"}
              aria-disabled={unmet === undefined ? undefined : true}
              title={unmet}
              data-kids-add-label={adds ? action.label : undefined}
              data-glyph={
                (adds && action.block ? GLYPH[action.block] : undefined) ?? TONE_GLYPH[tone]
              }
              disabled={action.disabled ?? false}
              onClick={unmet === undefined ? action.onAdd : () => rules?.onBlocked(unmet)}
            >
              {adds ? <span className="kids-visually-hidden">+ </span> : null}
              {action.label}
            </button>
          );
        })}
      </span>
      {children === undefined ? null : <span className="kids-palette-tool-slots">{children}</span>}
    </div>
  );
}
