import { captureOriDeterministicBaseline } from "./oriDeterministicBaseline.js";
import { projectLegacyOriOffer, projectOriShadowPlan } from "./oriSemanticProjection.js";
import { compareOriSemanticProjections, type OriSemanticComparison } from "./oriSemanticComparison.js";
import type { OriShadowPlan } from "./oriShadowPlanValidation.js";

export interface OriMissionSemanticFinding {
  readonly missionId: string;
  readonly missionIndex: number;
  readonly candidateAvailable: boolean;
  readonly comparison: OriSemanticComparison | null;
}

/**
 * Compares the real, read-only deterministic Kids baseline against separately
 * captured, validated Ori plans keyed by mission index. Missing plans remain
 * missing evidence; never synthesize a candidate or a parity score.
 */
export function compareOriMissionBaselines(
  plans: ReadonlyMap<number, OriShadowPlan>,
): readonly OriMissionSemanticFinding[] {
  return Object.freeze(captureOriDeterministicBaseline().map((record) => {
    const plan = plans.get(record.missionIndex);
    const matchingContext = plan?.context.missionStage === record.missionIndex;
    return Object.freeze({
      missionId: record.missionId,
      missionIndex: record.missionIndex,
      candidateAvailable: !!plan && matchingContext,
      comparison: plan && matchingContext
        ? compareOriSemanticProjections(projectLegacyOriOffer(record), projectOriShadowPlan(plan))
        : null,
    });
  }));
}
