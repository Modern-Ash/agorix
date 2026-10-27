import type { OriMissionDivergenceMatrix } from "./oriMissionDivergenceMatrix.js";
import { assessOriEvidenceQuality } from "./oriEvidenceQualityGate.js";

export interface OriEducatorReviewItem {
  readonly missionId: string;
  readonly missionIndex: number;
  readonly priority: "high" | "normal";
  readonly reason:
    "missing-evidence" | "technical-divergence" | "semantic-gap" | "observable-match";
  readonly educatorDecision: "pending";
}
export interface OriEducatorReviewPackage {
  readonly schemaVersion: "agorix/ori-educator-review/v1";
  readonly provenance: "real-loopback-ori-synthetic-inputs";
  readonly pedagogicalApproval: false;
  readonly evidenceQuality: ReturnType<typeof assessOriEvidenceQuality>;
  readonly reviewItems: readonly OriEducatorReviewItem[];
}

/**
 * Prepares an educator adjudication queue; never interprets technical parity
 * as educational approval. Only synthetic mission identifiers are included.
 */
export function createOriEducatorReviewPackage(
  matrix: OriMissionDivergenceMatrix,
): OriEducatorReviewPackage {
  const reviewItems = matrix.rows.map((row): OriEducatorReviewItem => {
    const reason =
      row.status === "missing"
        ? ("missing-evidence" as const)
        : row.status === "divergent"
          ? ("technical-divergence" as const)
          : row.notComparable > 0
            ? ("semantic-gap" as const)
            : ("observable-match" as const);
    return Object.freeze({
      missionId: row.missionId,
      missionIndex: row.missionIndex,
      priority:
        reason === "missing-evidence" || reason === "technical-divergence" ? "high" : "normal",
      reason,
      educatorDecision: "pending",
    });
  });
  return Object.freeze({
    schemaVersion: "agorix/ori-educator-review/v1",
    provenance: "real-loopback-ori-synthetic-inputs",
    pedagogicalApproval: false,
    evidenceQuality: assessOriEvidenceQuality(matrix),
    reviewItems: Object.freeze(reviewItems),
  });
}
