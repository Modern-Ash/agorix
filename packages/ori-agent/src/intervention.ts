import { ORI_STUDIO_INTENTS, type OriStudioIntent } from "./studio.js";

/**
 * When Ori may show an idea made of blocks (issues #615, #590). An administrator can move these
 * numbers inside the limits below; the limits are the safety floor and are not configurable: Ori
 * never offers a solution on entry (hint 1 or no failed run is never enough) and an idea never has
 * more blocks than the validators accept.
 */
export interface OriInterventionPolicy {
  /** Runs that missed the goal before Ori may offer an idea. */
  readonly minFailedRuns: number;
  /** Hints the child has opened before Ori may offer an idea. */
  readonly minHints: number;
  /** Most blocks in one idea. */
  readonly maxProposalBlocks: number;
}

export const ORI_INTERVENTION_LIMITS = Object.freeze({
  minFailedRuns: { min: 1, max: 5 },
  minHints: { min: 2, max: 5 },
  maxProposalBlocks: { min: 1, max: 8 },
});

export const ORI_INTERVENTION_DEFAULT: OriInterventionPolicy = Object.freeze({
  minFailedRuns: 1,
  minHints: 2,
  maxProposalBlocks: 8,
});

export function validateOriInterventionPolicy(raw: unknown): OriInterventionPolicy {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("invalid policy");
  const value = raw as Record<string, unknown>;
  if (Object.keys(value).sort().join() !== "maxProposalBlocks,minFailedRuns,minHints") {
    throw new Error("invalid policy");
  }
  const read = (key: keyof typeof ORI_INTERVENTION_LIMITS): number => {
    const number = value[key];
    const { min, max } = ORI_INTERVENTION_LIMITS[key];
    if (!Number.isInteger(number) || (number as number) < min || (number as number) > max) {
      throw new Error("invalid policy");
    }
    return number as number;
  };
  return {
    minFailedRuns: read("minFailedRuns"),
    minHints: read("minHints"),
    maxProposalBlocks: read("maxProposalBlocks"),
  };
}

export function shouldOfferOriIdea(
  progress: { readonly failedRuns: number; readonly hintsUsed: number },
  policy: OriInterventionPolicy = ORI_INTERVENTION_DEFAULT,
): boolean {
  return progress.failedRuns >= policy.minFailedRuns || progress.hintsUsed >= policy.minHints;
}

/** How many blocks each goal from the closed list proposes. */
const INTENT_SIZES: Readonly<Record<OriStudioIntent, number>> = {
  ahead: 3,
  square: 8,
  backForth: 6,
  zigzag: 8,
  melody: 6,
  rhythm: 6,
  cheer: 2,
};

export function oriIntentSize(intent: OriStudioIntent): number {
  return INTENT_SIZES[intent];
}

export function oriIntentsWithin(policy: OriInterventionPolicy): readonly OriStudioIntent[] {
  return ORI_STUDIO_INTENTS.filter((intent) => INTENT_SIZES[intent] <= policy.maxProposalBlocks);
}

/** Synthetic learners, never real ones: what the policy would do for each situation. */
export const ORI_SIMULATED_LEARNERS = Object.freeze([
  { id: "just-arrived", failedRuns: 0, hintsUsed: 0 },
  { id: "first-miss", failedRuns: 1, hintsUsed: 0 },
  { id: "two-misses", failedRuns: 2, hintsUsed: 0 },
  { id: "first-hint", failedRuns: 0, hintsUsed: 1 },
  { id: "second-hint", failedRuns: 0, hintsUsed: 2 },
  { id: "stuck-with-hints", failedRuns: 3, hintsUsed: 3 },
] as const);

export interface OriSimulation {
  readonly learner: (typeof ORI_SIMULATED_LEARNERS)[number]["id"];
  readonly offersIdea: boolean;
  readonly maxBlocks: number;
  readonly goals: number;
}

export function simulateOriIntervention(policy: OriInterventionPolicy): readonly OriSimulation[] {
  return ORI_SIMULATED_LEARNERS.map((learner) => {
    const offers = shouldOfferOriIdea(learner, policy);
    return {
      learner: learner.id,
      offersIdea: offers,
      maxBlocks: offers ? policy.maxProposalBlocks : 0,
      goals: oriIntentsWithin(policy).length,
    };
  });
}
