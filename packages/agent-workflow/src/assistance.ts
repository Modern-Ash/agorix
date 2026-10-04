import type { WorkflowMode } from "./loop.js";

export type AssistanceLevel = 0 | 1 | 2 | 3 | 4 | 5;

export type OfferableSignal =
  "runtime-error" | "stalled" | "repeated-error" | "repeat-pattern" | "first-step";

/** Visible, learner-controlled settings for how the agent behaves. No hidden configuration. */
export interface AgentAgreements {
  readonly aiEnabled: boolean;
  /** Highest hint-ladder level the agent may use (PEDAGOGY.md levels 0-5). */
  readonly assistanceCeiling: AssistanceLevel;
  readonly mode: WorkflowMode;
  readonly proactive: Readonly<Record<OfferableSignal, boolean>>;
}

export const DEFAULT_AGREEMENTS: AgentAgreements = {
  aiEnabled: true,
  assistanceCeiling: 4,
  mode: "supervised",
  proactive: {
    "runtime-error": true,
    stalled: true,
    "repeated-error": true,
    "repeat-pattern": true,
    "first-step": true,
  },
};

const COMPLETE_SOLUTION: AssistanceLevel = 5;
const REPEATED_FAILURE_FOR_COMPLETE = 2;

/** Rises at most one level per call; level 5 needs an explicit request after repeated failure. */
export function nextAssistanceLevel(
  current: AssistanceLevel,
  signal: { readonly repeatedFailures: number; readonly explicitStrongerHelp: boolean },
): AssistanceLevel {
  if (signal.repeatedFailures < 1 || current >= COMPLETE_SOLUTION) {
    return current;
  }
  const next = (current + 1) as AssistanceLevel;
  if (
    next === COMPLETE_SOLUTION &&
    !(signal.explicitStrongerHelp && signal.repeatedFailures >= REPEATED_FAILURE_FOR_COMPLETE)
  ) {
    return current;
  }
  return next;
}

export function deescalate(level: AssistanceLevel): AssistanceLevel {
  return Math.max(0, level - 1) as AssistanceLevel;
}

export function effectiveAssistance(
  agreements: AgentAgreements,
  requested: AssistanceLevel,
): AssistanceLevel {
  if (!agreements.aiEnabled) {
    return 0;
  }
  return Math.min(requested, agreements.assistanceCeiling) as AssistanceLevel;
}

export function canOffer(agreements: AgentAgreements, signal: OfferableSignal): boolean {
  return agreements.aiEnabled && agreements.proactive[signal];
}
