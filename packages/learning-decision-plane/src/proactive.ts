import type { LayaBatchTransport } from "./laya.js";

export type ProactiveSignalKind = "repeat-pattern" | "first-step";

export interface ProactiveSignal {
  readonly kind: ProactiveSignalKind;
  /** repeat-pattern: times the same steps were written in a row. first-step: statements so far. */
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
  /** Which layer produced the decision. */
  readonly source: "system0" | "laya";
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
    source: "system0",
  });
  if (signal.running) {
    return silence("learner-is-executing");
  }
  if (signal.kind === "repeat-pattern" && signal.occurrences < PROACTIVE_MIN_OCCURRENCES) {
    return silence("pattern-too-weak");
  }
  if (signal.kind === "first-step" && signal.occurrences > 0) {
    return silence("learner-already-started");
  }
  if (signal.declinedForCurrentProgram) {
    return silence("learner-declined-this-program");
  }
  if (signal.declinedCount >= PROACTIVE_MAX_DECLINES) {
    return silence("learner-repeatedly-declined");
  }
  return {
    action: "offer",
    reason: signal.kind === "first-step" ? "empty-program" : "repeated-steps-detected",
    generativeNeeded: "no",
    source: "system0",
  };
}

export const LAYA_PROACTIVE_QUESTION = "proactiveAction";
export const LAYA_PROACTIVE_THRESHOLD = 0.9;

/**
 * System-0 decides first. Laya can only make the product quieter: when System-0
 * says offer, Laya may veto with high confidence. It can never create an offer
 * that System-0 refused, and any transport failure falls back to System-0.
 */
export async function decideProactiveWithLaya(
  signal: ProactiveSignal,
  transport: LayaBatchTransport | undefined,
): Promise<ProactiveDecision> {
  const base = decideProactiveSuggestion(signal);
  if (base.action === "silence" || transport === undefined) {
    return base;
  }
  try {
    const [answer] = await transport.decideMany({
      state: {
        kind: signal.kind,
        occurrences: signal.occurrences,
        declinedCount: signal.declinedCount,
      },
      questions: [{ id: LAYA_PROACTIVE_QUESTION, type: "choice", choices: ["silence", "offer"] }],
    });
    if (
      answer?.id === LAYA_PROACTIVE_QUESTION &&
      answer.value === "silence" &&
      answer.confidence >= LAYA_PROACTIVE_THRESHOLD
    ) {
      return { ...base, action: "silence", reason: "laya-judged-not-now", source: "laya" };
    }
  } catch {
    // Laya is optional; System-0 stays authoritative.
  }
  return base;
}
