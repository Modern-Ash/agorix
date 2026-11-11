import type { Statement } from "@agorix/program-model";
import type { Locale } from "../i18n.js";
import { usedBlockKinds, type StudioBlockKind } from "./kidsPaletteCatalog.js";

/**
 * Dependencies between palette blocks (issue #1235). A block that means nothing yet (stopping
 * sounds when none was ever played, bringing a lone character to the front) stays in the palette
 * but is dimmed with a one-line reason, so the catalog is still whole and the child learns what the
 * block needs. It is presentation only: it never changes the program, the runtime or what a saved
 * project may contain, and a project that already uses such a block keeps working.
 */
export type PaletteNeed =
  "sound" | "characters" | "effect" | "list" | "variable" | "pen" | "costumes";

/** What each rule needs, by block. Blocks absent here are always available. */
export const BLOCK_NEEDS: Partial<Record<StudioBlockKind, PaletteNeed>> = {
  stopSounds: "sound",
  goToLayer: "characters",
  clearEffects: "effect",
  listRemoveAt: "list",
  listInsertAt: "list",
  listReplaceAt: "list",
  showVariable: "variable",
  hideVariable: "variable",
  showList: "list",
  hideList: "list",
  listClear: "list",
  penUp: "pen",
  nextCostume: "costumes",
  clearPen: "pen",
  stamp: "pen",
};

/** Blocks that satisfy a need when any character's program uses one of them. */
const SATISFIED_BY: Readonly<
  Record<Exclude<PaletteNeed, "characters" | "costumes">, readonly string[]>
> = {
  sound: ["playSound", "playNote", "playDrum"],
  effect: ["setEffect", "changeEffect"],
  list: ["listAdd"],
  variable: ["setVariable", "changeVariable"],
  pen: ["penDown"],
};

export interface PaletteFacts {
  /** Every block kind used by any character's program, loops and branches included. */
  readonly used: ReadonlySet<string>;
  readonly characterCount: number;
  /** Costumes the child drew or added: "next costume" has something to cycle only with these. */
  readonly ownCostumes: number;
}

export function paletteFacts(
  scripts: readonly { readonly statements: readonly Statement[] }[],
  characterCount: number,
  ownCostumes = 0,
): PaletteFacts {
  return {
    used: usedBlockKinds(scripts.flatMap((script) => script.statements)),
    characterCount,
    ownCostumes,
  };
}

/** The need that is not met yet for `kind`, or `undefined` when the block is ready to use. */
export function unmetNeed(kind: StudioBlockKind, facts: PaletteFacts): PaletteNeed | undefined {
  const need = BLOCK_NEEDS[kind];
  if (need === undefined) return undefined;
  if (need === "characters") return facts.characterCount >= 2 ? undefined : need;
  if (need === "costumes") return facts.ownCostumes >= 1 ? undefined : need;
  return SATISFIED_BY[need].some((used) => facts.used.has(used)) ? undefined : need;
}

const HINTS: Record<Locale, Record<PaletteNeed, string>> = {
  es: {
    sound: "Primero poné un bloque de sonido: no hay nada que detener.",
    characters: "Necesitás dos personajes para cambiar quién va adelante.",
    effect: "Primero poné un efecto: no hay nada que borrar.",
    list: "Primero agregá un elemento a la lista.",
    variable: "Primero dale un valor a la variable.",
    pen: "Primero bajá el lápiz: no hay dibujo todavía.",
    costumes: "Primero dibujá otro disfraz: no hay a cuál cambiar.",
  },
  en: {
    sound: "Add a sound block first: there is nothing to stop.",
    characters: "You need two characters to change who is in front.",
    effect: "Add an effect first: there is nothing to clear.",
    list: "Add an item to the list first.",
    variable: "Give the variable a value first.",
    pen: "Put the pen down first: there is no drawing yet.",
    costumes: "Draw another costume first: there is nothing to change to.",
  },
};

export function needHint(need: PaletteNeed, locale: Locale): string {
  return HINTS[locale][need];
}
