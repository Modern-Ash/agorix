import type { OriMissionDivergenceMatrix } from "./oriMissionDivergenceMatrix.js";
import type { OriReviewSamplingPlan } from "./oriPedagogicalReviewSampling.js";

export type OriAutomatedFinding =
  | "missing-candidate" | "observable-divergence"
  | "semantic-not-comparable" | "observable-match";
export interface OriAutomatedTriageRow {
  readonly missionId: string;
  readonly missionIndex: number;
  readonly finding: OriAutomatedFinding;
  readonly selectedForReview: boolean;
  readonly pedagogicalScore: null;
}
export interface OriAutomatedTriageReport {
  readonly schemaVersion: "agorix/ori-mig03-automated-triage/v1";
  readonly total: number;
  readonly selected: number;
  readonly deferred: number;
  readonly missing: number;
  readonly divergent: number;
  readonly semanticGaps: number;
  readonly rows: readonly OriAutomatedTriageRow[];
  readonly pedagogicalApproval: false;
  readonly rolloutAuthorized: false;
}

/**
 * Deterministic technical triage, not an LLM judge. Only observable
 * compatibility is classified; educational merit remains unscored.
 */
export function buildOriAutomatedTriageReport(
  matrix: OriMissionDivergenceMatrix,
  sampling: OriReviewSamplingPlan,
): OriAutomatedTriageReport {
  const ids = matrix.rows.map((row) => row.missionId);
  const selected = new Set(sampling.selected.map((item) => item.missionId));
  const deferred = new Set(sampling.deferred);
  if (sampling.totalMissions !== matrix.total || matrix.rows.length !== matrix.total ||
      new Set(ids).size !== ids.length ||
      selected.size !== sampling.selected.length ||
      selected.size + deferred.size !== matrix.total ||
      ids.some((id) => !selected.has(id) && !deferred.has(id)) ||
      [...deferred].some((id) => !ids.includes(id) || selected.has(id)))
    throw Error("inconsistent-review-sampling");
  const rows = matrix.rows.map((row): OriAutomatedTriageRow => Object.freeze({
    missionId: row.missionId,
    missionIndex: row.missionIndex,
    finding: row.status === "missing" ? "missing-candidate"
      : row.divergences > 0 ? "observable-divergence"
        : row.notComparable > 0 ? "semantic-not-comparable"
          : "observable-match",
    selectedForReview: selected.has(row.missionId),
    pedagogicalScore: null,
  }));
  return Object.freeze({
    schemaVersion: "agorix/ori-mig03-automated-triage/v1",
    total: matrix.total,
    selected: selected.size,
    deferred: deferred.size,
    missing: rows.filter((row) => row.finding === "missing-candidate").length,
    divergent: rows.filter((row) => row.finding === "observable-divergence").length,
    semanticGaps: rows.filter((row) => row.finding === "semantic-not-comparable").length,
    rows: Object.freeze(rows),
    pedagogicalApproval: false,
    rolloutAuthorized: false,
  });
}
