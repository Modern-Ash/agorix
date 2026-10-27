import type { OriReviewBriefing } from "./oriMig03ReviewBriefing.js";
import type { OriPedagogicalReviewCase } from "./oriPedagogicalReviewCorpus.js";

export interface OriReviewChecklistItem {
  readonly missionId: string;
  readonly priority: "high" | "normal";
  readonly requiredEvidence: readonly string[];
  readonly humanDecision: "pending";
}
export interface OriReviewChecklist {
  readonly schemaVersion: "agorix/ori-mig03-review-checklist/v1";
  readonly items: readonly OriReviewChecklistItem[];
  readonly deferredMissionIds: readonly string[];
  readonly formalApproval: false;
  readonly rolloutAuthorized: false;
}

/** Prepare a human-facing checklist without claiming educational assessment. */
export function buildOriReviewChecklist(
  briefing: OriReviewBriefing,
  corpus: readonly OriPedagogicalReviewCase[],
): OriReviewChecklist {
  const byId = new Map(corpus.map((item) => [item.missionId, item]));
  if (byId.size !== corpus.length ||
      corpus.length !== briefing.summary.totalMissions ||
      briefing.selectedMissionIds.length !== briefing.summary.selectedForReview ||
      briefing.selectedMissionIds.some((id) => !byId.has(id)) ||
      briefing.summary.deferred + briefing.summary.selectedForReview !== corpus.length)
    throw Error("inconsistent-review-checklist");
  return Object.freeze({
    schemaVersion: "agorix/ori-mig03-review-checklist/v1",
    items: Object.freeze(briefing.selectedMissionIds.map((id) => {
      const item = byId.get(id)!;
      return Object.freeze({
        missionId: id,
        priority: item.priority,
        requiredEvidence: Object.freeze([
          "ori-proposal", "kids-baseline", "learning-context",
          "learner-facing-explanation", "educator-rationale",
        ]),
        humanDecision: "pending" as const,
      });
    })),
    deferredMissionIds: Object.freeze(corpus
      .filter((item) => !briefing.selectedMissionIds.includes(item.missionId))
      .map((item) => item.missionId)),
    formalApproval: false,
    rolloutAuthorized: false,
  });
}
