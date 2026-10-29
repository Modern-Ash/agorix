import type { OriAutomatedTriageReport } from "./oriAutomatedPedagogicalTriage.js";
import type { OriReviewSamplingPlan } from "./oriPedagogicalReviewSampling.js";

export interface OriReviewBriefing {
  readonly schemaVersion: "agorix/ori-mig03-review-briefing/v1";
  readonly summary: {
    readonly totalMissions: number;
    readonly selectedForReview: number;
    readonly deferred: number;
    readonly mandatory: number;
    readonly missing: number;
    readonly divergent: number;
    readonly semanticGaps: number;
  };
  readonly selectedMissionIds: readonly string[];
  readonly unresolvedMissionIds: readonly string[];
  readonly humanAcceptance: "pending";
  readonly rolloutAuthorized: false;
}

/**
 * Reviewer-facing briefing from synthetic technical evidence. Does not infer
 * pedagogical success from a technical match or sampling coverage.
 */
export function buildOriReviewBriefing(
  triage: OriAutomatedTriageReport,
  plan: OriReviewSamplingPlan,
): OriReviewBriefing {
  if (
    triage.total !== plan.totalMissions ||
    triage.selected !== plan.selected.length ||
    triage.deferred !== plan.deferred.length ||
    triage.rows.length !== triage.total ||
    plan.selected.some(
      (item) =>
        !triage.rows.some((row) => row.missionId === item.missionId && row.selectedForReview),
    ) ||
    plan.deferred.some(
      (id) => !triage.rows.some((row) => row.missionId === id && !row.selectedForReview),
    )
  )
    throw Error("inconsistent-review-briefing");
  const unresolvedMissionIds = triage.rows
    .filter((row) => row.finding !== "observable-match")
    .map((row) => row.missionId);
  return Object.freeze({
    schemaVersion: "agorix/ori-mig03-review-briefing/v1",
    summary: Object.freeze({
      totalMissions: triage.total,
      selectedForReview: triage.selected,
      deferred: triage.deferred,
      mandatory: plan.mandatoryCount,
      missing: triage.missing,
      divergent: triage.divergent,
      semanticGaps: triage.semanticGaps,
    }),
    selectedMissionIds: Object.freeze(plan.selected.map((item) => item.missionId)),
    unresolvedMissionIds: Object.freeze(unresolvedMissionIds),
    humanAcceptance: "pending",
    rolloutAuthorized: false,
  });
}
