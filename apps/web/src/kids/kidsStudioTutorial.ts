import type { Locale } from "../i18n.js";

/**
 * A first-run coach for Escena libre (issue #1126). It reads facts from the editor, never blocks
 * the palette or Play, and ends on its own once the child has stepped through a run and seen
 * what each block did. It teaches the debugging tools that already exist: Play, Step and the
 * watchers; it adds no second debugger.
 */
export type StudioTutorialStep = "add" | "play" | "step";

export interface StudioTutorialFacts {
  readonly blocks: number;
  /** A run has produced a result. */
  readonly ran: boolean;
  /** The child has used Step on a run. */
  readonly stepped: boolean;
}

export function studioTutorialStep(facts: StudioTutorialFacts): StudioTutorialStep | null {
  if (facts.stepped) return null;
  if (facts.blocks === 0) return "add";
  if (!facts.ran) return "play";
  return "step";
}

const TEXT: Record<Locale, Record<StudioTutorialStep | "title" | "skip" | "help", string>> = {
  es: {
    title: "Primeros pasos",
    add: "Elegí un bloque de la paleta, por ejemplo “+ Mover”, para armar tu programa.",
    play: "Tocá “Jugar” para ver qué hace tu programa en el escenario.",
    step: "Tocá “Paso” para avanzar de a un bloque y mirar qué cambia en el escenario.",
    skip: "Listo, no mostrar más",
    help: "Ayuda",
  },
  en: {
    title: "First steps",
    add: "Pick a block from the palette, like “+ Move”, to build your program.",
    play: "Tap “Play” to see what your program does on the stage.",
    step: "Tap “Step” to go one block at a time and watch what changes on the stage.",
    skip: "Got it, stop showing",
    help: "Help",
  },
};

export function studioTutorialText(
  key: StudioTutorialStep | "title" | "skip" | "help",
  locale: Locale,
): string {
  return TEXT[locale][key];
}

export const STUDIO_TUTORIAL_KEY = "agorix.kids.studioTutorial.v1";

type Store = Pick<Storage, "getItem" | "setItem">;

function browserStore(): Store | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

/** Once per device: dismissing or finishing hides it until the child asks for Ayuda. */
export function studioTutorialDone(store: Store | undefined = browserStore()): boolean {
  try {
    return store?.getItem(STUDIO_TUTORIAL_KEY) === "done";
  } catch {
    return false;
  }
}

export function setStudioTutorialDone(
  done: boolean,
  store: Store | undefined = browserStore(),
): void {
  try {
    store?.setItem(STUDIO_TUTORIAL_KEY, done ? "done" : "open");
  } catch {
    // The coach still hides for this visit.
  }
}
