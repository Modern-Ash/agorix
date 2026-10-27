import { conceptsOfProgram, type MasteryState, type MasteryStage } from "@agorix/learning-evidence";
import type { OriInterventionPolicy } from "@agorix/ori-agent";
import type { ProjectProgram } from "@agorix/program-model";

/** Ideas for a child still discovering a concept stay short. */
export const BEGINNER_MAX_BLOCKS = 6;
/** From this stage on (Prueba) the child has shown the concept without help. */
export const CONFIDENT_STAGE: MasteryStage = 3;

export type StageBand = "beginner" | "growing" | "confident";

/** The stages of the concepts the program uses. */
export function stagesOfProgram(
  mastery: MasteryState,
  program: ProjectProgram,
): readonly MasteryStage[] {
  return conceptsOfProgram(program).map((concept) => mastery.concepts[concept].stage);
}

export function stageBand(stages: readonly MasteryStage[]): StageBand {
  // A program with no blocks yet says nothing about the child, so it keeps the normal pace.
  if (stages.length === 0) return "growing";
  const lowest = Math.min(...stages);
  if (lowest <= 1) return "beginner";
  return lowest >= CONFIDENT_STAGE ? "confident" : "growing";
}

/**
 * Ori's pacing follows what the runtime has shown (issue #611): a beginner gets shorter ideas, and a
 * child who already shows the concepts on their own waits one more miss or hint before an idea
 * appears. It only ever makes Ori more patient or its ideas smaller, never the other way, so the
 * administrator's numbers and the safety floor stay the outer limit. Nothing here leaves the device.
 */
export function adaptInterventionByStage(
  policy: OriInterventionPolicy,
  band: StageBand,
): OriInterventionPolicy {
  if (band === "beginner") {
    return {
      ...policy,
      maxProposalBlocks: Math.min(policy.maxProposalBlocks, BEGINNER_MAX_BLOCKS),
    };
  }
  if (band === "confident") {
    return {
      ...policy,
      minFailedRuns: Math.min(5, policy.minFailedRuns + 1),
      minHints: Math.min(5, policy.minHints + 1),
    };
  }
  return policy;
}
