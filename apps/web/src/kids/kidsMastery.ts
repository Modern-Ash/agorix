import {
  applyEvidence,
  emptyMastery,
  readMastery,
  type MasteryEvidence,
  type MasteryState,
} from "@agorix/learning-evidence";
import { localDay } from "./kidsAdults.js";

/**
 * What the child's runs have shown, kept on this device (docs/superpowers/specs/
 * 2026-10-26-kids-mastery-stages-design.md). Only counters, stages and the last changes with a day
 * and a reason code: no program, no text, no project id. It is never sent to Ori or any provider, and
 * nothing in the app shows it yet.
 */
export const KIDS_MASTERY_KEY = "agorix.kids.mastery.v1";

type Store = Pick<Storage, "getItem" | "setItem">;

function browserStore(): Store | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

export function loadKidsMastery(store: Store | undefined = browserStore()): MasteryState {
  try {
    return readMastery(JSON.parse(store?.getItem(KIDS_MASTERY_KEY) ?? "null"));
  } catch {
    return emptyMastery();
  }
}

/** Add one piece of evidence and keep it. A failure to keep never reaches the child. */
export function recordMastery(
  evidence: MasteryEvidence,
  store: Store | undefined = browserStore(),
  day: string = localDay(),
): MasteryState {
  const next = applyEvidence(loadKidsMastery(store), evidence, day);
  try {
    store?.setItem(KIDS_MASTERY_KEY, JSON.stringify(next));
  } catch {
    // Without storage the app works exactly the same.
  }
  return next;
}
