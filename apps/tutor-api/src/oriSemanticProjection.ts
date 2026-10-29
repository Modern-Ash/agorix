import type { OriDeterministicBaselineRecord } from "./oriDeterministicBaseline.js";
import type { OriShadowPlan } from "./oriShadowPlanValidation.js";

/**
 * A deliberately limited shared projection. Only independently observable
 * properties are mapped. Missing information remains unknown, never inferred.
 */
export interface OriSemanticProjection {
  readonly source: "legacy-action" | "ori-plan";
  readonly actionFamily: "movement" | "control" | "completion" | "unknown";
  readonly reviewRequired: boolean | null;
  readonly mutatesProgram: boolean;
  readonly pedagogicalHintLevel: number | null;
}
export function projectLegacyOriOffer(
  record: OriDeterministicBaselineRecord,
): OriSemanticProjection {
  const actionFamily =
    record.kind === "move" || record.kind === "turn"
      ? ("movement" as const)
      : record.kind === "repeat"
        ? ("control" as const)
        : record.kind === "done" || record.kind === "passed"
          ? ("completion" as const)
          : ("unknown" as const);
  return Object.freeze({
    source: "legacy-action",
    actionFamily,
    reviewRequired: record.hasReviewableProposal,
    mutatesProgram: !record.starterProgramUnchanged,
    pedagogicalHintLevel: null,
  });
}
export function projectOriShadowPlan(plan: OriShadowPlan): OriSemanticProjection {
  return Object.freeze({
    source: "ori-plan",
    actionFamily: "unknown",
    reviewRequired: plan.requiresLearnerApproval,
    mutatesProgram: plan.appliedChanges,
    pedagogicalHintLevel: plan.stage,
  });
}
