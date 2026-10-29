import type { OriMissionDivergenceMatrix } from "./oriMissionDivergenceMatrix.js";

export interface OriEvidenceQualityGate {
  readonly status: "complete-technical-evidence" | "incomplete";
  readonly coverage: number | null;
  readonly reasons: readonly string[];
  /** Technical completeness never grants child-facing rollout approval. */
  readonly pedagogicalApproval: false;
}

/**
 * MIG-03 technical evidence gate: completeness and integrity only.
 * Semantic divergences remain visible and require educator adjudication.
 */
export function assessOriEvidenceQuality(
  matrix: OriMissionDivergenceMatrix,
): OriEvidenceQualityGate {
  const reasons: string[] = [];
  if (!Number.isSafeInteger(matrix.total) || matrix.total < 1) reasons.push("empty-corpus");
  if (matrix.available + matrix.missing !== matrix.total) reasons.push("coverage-inconsistent");
  if (matrix.rows.length !== matrix.total) reasons.push("row-count-inconsistent");
  if (new Set(matrix.rows.map((row) => row.missionId)).size !== matrix.rows.length)
    reasons.push("duplicate-mission");
  if (
    matrix.rows.some(
      (row) =>
        !row.missionId ||
        !Number.isSafeInteger(row.missionIndex) ||
        row.missionIndex < 0 ||
        row.matches < 0 ||
        row.divergences < 0 ||
        row.notComparable < 0,
    )
  )
    reasons.push("invalid-row");
  if (matrix.missing > 0) reasons.push("missing-ori-evidence");
  return Object.freeze({
    status: reasons.length === 0 ? "complete-technical-evidence" : "incomplete",
    coverage: matrix.total > 0 ? matrix.available / matrix.total : null,
    reasons: Object.freeze(reasons),
    pedagogicalApproval: false,
  });
}
