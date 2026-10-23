export type TutorialStep = "add" | "number" | "predict" | "run";

export interface TutorialFacts {
  readonly blocks: number;
  readonly numberTouched: boolean;
  /** The prediction question is open. */
  readonly predicting: boolean;
  /** A run has produced a result. */
  readonly ran: boolean;
}

/**
 * The coach step for what the child is doing right now, or null once they have run a program.
 * It reads facts from the editor and never blocks play: pressing Jugar early jumps to "predict".
 */
export function tutorialStep(facts: TutorialFacts): TutorialStep | null {
  if (facts.ran) return null;
  if (facts.predicting) return "predict";
  if (facts.blocks === 0) return "add";
  if (!facts.numberTouched) return "number";
  return "run";
}

/** Only the very first mission, never a free project, and only once per device. */
export function tutorialVisible(input: {
  readonly enabled: boolean;
  readonly done: boolean;
  readonly missionIndex: number;
  readonly freeProject: boolean;
}): boolean {
  return input.enabled && !input.done && input.missionIndex === 0 && !input.freeProject;
}
