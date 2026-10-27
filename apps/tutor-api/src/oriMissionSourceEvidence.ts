import type { OriPlanConsumer } from "./oriPlanConsumer.js";
import { captureOriDeterministicBaseline } from "./oriDeterministicBaseline.js";
import type { OriShadowPlan } from "./oriShadowPlanValidation.js";

/**
 * Captures actual read-only Ori plans and the independent Kids baseline.
 * No learner-facing explanation or educator rationale is synthesized.
 */
export async function captureOriMissionSourceEvidence(
  consumer: OriPlanConsumer,
  hintLevel: 2 | 3 = 2,
) {
  const results: {
    readonly missionId: string;
    readonly missionIndex: number;
    readonly oriProposal: OriShadowPlan | null;
    readonly kidsBaseline: unknown;
    readonly provenance: "ori-loopback-synthetic-mission";
  }[] = [];
  for (const mission of captureOriDeterministicBaseline()) {
    let proposal: OriShadowPlan | null = null;
    try {
      const candidate = await consumer.evaluate({
        missionIndex: mission.missionIndex,
        hintLevel,
        scriptCount: 1,
      });
      if (candidate && candidate.context.missionStage === mission.missionIndex &&
          candidate.stage === hintLevel && candidate.appliedChanges === false)
        proposal = candidate;
    } catch {
      // Preserve unavailable evidence; never fabricate an Ori response.
    }
    results.push(Object.freeze({
      missionId: mission.missionId,
      missionIndex: mission.missionIndex,
      oriProposal: proposal,
      kidsBaseline: mission,
      provenance: "ori-loopback-synthetic-mission" as const,
    }));
  }
  return Object.freeze(results);
}
