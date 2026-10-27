import type { OriReviewBriefing } from "./oriMig03ReviewBriefing.js";
import type { OriReviewChecklist } from "./oriMig03ReviewChecklist.js";

export interface OriMig03ReviewHandoff {
  readonly schemaVersion: "agorix/ori-mig03-review-handoff/v1";
  readonly missionCount: number;
  readonly selectedForReview: number;
  readonly pendingEvidence: readonly {
    readonly missionId: string;
    readonly requiredEvidence: readonly string[];
    readonly status: "awaiting-human-review";
  }[];
  readonly deferredMissionIds: readonly string[];
  readonly unresolvedMissionIds: readonly string[];
  readonly nextAction: "educator-review-required";
  readonly formalApproval: false;
  readonly rolloutAuthorized: false;
}

/** Deterministic handoff; no fabricated educator decisions or evidence. */
export function buildOriMig03ReviewHandoff(
  briefing: OriReviewBriefing,
  checklist: OriReviewChecklist,
): OriMig03ReviewHandoff {
  const selected = new Set(briefing.selectedMissionIds);
  const deferred = new Set(checklist.deferredMissionIds);
  if (selected.size !== briefing.selectedMissionIds.length ||
      checklist.items.length !== selected.size ||
      checklist.items.some((item) => !selected.has(item.missionId)) ||
      deferred.size !== checklist.deferredMissionIds.length ||
      [...deferred].some((id) => selected.has(id)) ||
      selected.size + deferred.size !== briefing.summary.totalMissions ||
      briefing.summary.deferred !== deferred.size)
    throw Error("inconsistent-review-handoff");
  return Object.freeze({
    schemaVersion: "agorix/ori-mig03-review-handoff/v1",
    missionCount: briefing.summary.totalMissions,
    selectedForReview: selected.size,
    pendingEvidence: Object.freeze(checklist.items.map((item) => Object.freeze({
      missionId: item.missionId,
      requiredEvidence: item.requiredEvidence,
      status: "awaiting-human-review" as const,
    }))),
    deferredMissionIds: Object.freeze([...checklist.deferredMissionIds]),
    unresolvedMissionIds: Object.freeze([...briefing.unresolvedMissionIds]),
    nextAction: "educator-review-required",
    formalApproval: false,
    rolloutAuthorized: false,
  });
}
