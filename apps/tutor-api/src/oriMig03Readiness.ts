import type { OriMissionDivergenceMatrix } from "./oriMissionDivergenceMatrix.js";
import { assessOriEvidenceQuality } from "./oriEvidenceQualityGate.js";
import { createOriEducatorReviewPackage } from "./oriEducatorReviewPackage.js";
import { assessOriEducatorSignoff, type OriEducatorDecision } from "./oriEducatorSignoff.js";

export interface OriMig03Readiness {
  readonly status: "ready-for-human-acceptance" | "blocked";
  readonly reasons: readonly string[];
  readonly technicalCoverage: number | null;
  readonly educatorReviewed: number;
  readonly educatorRequired: number;
  readonly rolloutAuthorized: false;
}

/**
 * Offline acceptance checklist. This is NOT a product release gate:
 * reviewer authentication and evidence provenance are host responsibilities.
 */
export function assessOriMig03Readiness(
  matrix: OriMissionDivergenceMatrix,
  decisions: readonly OriEducatorDecision[],
  evidenceProvenanceVerified: boolean,
): OriMig03Readiness {
  const evidence = assessOriEvidenceQuality(matrix);
  const review = createOriEducatorReviewPackage(matrix);
  const signoff = assessOriEducatorSignoff(review, decisions);
  const reasons: string[] = [];
  if (evidence.status !== "complete-technical-evidence")
    reasons.push("technical-evidence-incomplete");
  if (!evidenceProvenanceVerified) reasons.push("unverified-evidence-provenance");
  if (signoff.status !== "approved") reasons.push("educator-signoff-incomplete");
  if (matrix.rows.some((row) => row.notComparable > 0))
    reasons.push("semantic-gaps-require-adjudication");
  return Object.freeze({
    status: reasons.length === 0 ? "ready-for-human-acceptance" : "blocked",
    reasons: Object.freeze(reasons),
    technicalCoverage: evidence.coverage,
    educatorReviewed: signoff.reviewed,
    educatorRequired: signoff.required,
    rolloutAuthorized: false,
  });
}
