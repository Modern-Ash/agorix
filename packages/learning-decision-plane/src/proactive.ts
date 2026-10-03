export type ProactiveSignalKind = "repeat-pattern";

export interface ProactiveSignal {
  readonly kind: ProactiveSignalKind;
  /** How many times the same steps were written out in a row. */
  readonly occurrences: number;
  /** The learner is executing the program right now. */
  readonly running: boolean;
  /** The learner already said no to this exact program. */
  readonly declinedForCurrentProgram: boolean;
  /** How many suggestions of this kind the learner declined this session. */
  readonly declinedCount: number;
}

export type ProactiveAction = "silence" | "offer";

export interface ProactiveDecision {
  readonly action: ProactiveAction;
  readonly reason: string;
  /** Proactive suggestions are always deterministic; no provider is involved. */
  readonly generativeNeeded: "no";
}

export const PROACTIVE_MIN_OCCURRENCES = 3;
export const PROACTIVE_MAX_DECLINES = 2;

/**
 * System-0 rule for unprompted help: staying quiet is a first-class outcome.
 * Pure and deterministic, so it works offline and never selects a provider.
 */
export function decideProactiveSuggestion(signal: ProactiveSignal): ProactiveDecision {
  const silence = (reason: string): ProactiveDecision => ({
    action: "silence",
    reason,
    generativeNeeded: "no",
  });
  if (signal.running) {
    return silence("learner-is-executing");
  }
  if (signal.occurrences < PROACTIVE_MIN_OCCURRENCES) {
    return silence("pattern-too-weak");
  }
  if (signal.declinedForCurrentProgram) {
    return silence("learner-declined-this-program");
  }
  if (signal.declinedCount >= PROACTIVE_MAX_DECLINES) {
    return silence("learner-repeatedly-declined");
  }
  return { action: "offer", reason: "repeated-steps-detected", generativeNeeded: "no" };
}
