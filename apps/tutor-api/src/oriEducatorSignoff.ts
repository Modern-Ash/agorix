import type { OriEducatorReviewPackage } from "./oriEducatorReviewPackage.js";

export interface OriEducatorDecision {
  readonly missionId: string;
  readonly decision: "approve" | "reject";
  readonly reviewerId: string;
  readonly rationale: string;
}
export interface OriEducatorSignoff {
  readonly status: "approved" | "blocked";
  readonly reasons: readonly string[];
  readonly reviewed: number;
  readonly required: number;
  /** Never an automatic rollout authorization. */
  readonly rolloutAuthorized: false;
}

/**
 * Human-entered educator decisions on synthetic mission evidence.
 * This function never authenticates a reviewer; a trusted administrative
 * workflow must validate identity, provenance and reviewer authority.
 */
export function assessOriEducatorSignoff(
  review: OriEducatorReviewPackage,
  decisions: readonly OriEducatorDecision[],
): OriEducatorSignoff {
  const reasons: string[] = [];
  if (review.evidenceQuality.status !== "complete-technical-evidence")
    reasons.push("technical-evidence-incomplete");
  const expected = new Set(review.reviewItems.map((item) => item.missionId));
  const seen = new Set<string>();
  for (const decision of decisions) {
    if (!expected.has(decision.missionId) || seen.has(decision.missionId)) {
      reasons.push("invalid-review-set");
      continue;
    }
    seen.add(decision.missionId);
    if (
      !decision.reviewerId.trim() ||
      decision.reviewerId.length > 128 ||
      decision.rationale.trim().length < 12 ||
      decision.rationale.length > 2000
    )
      reasons.push("insufficient-review-evidence");
    if (decision.decision !== "approve" && decision.decision !== "reject")
      reasons.push("invalid-decision");
    if (decision.decision === "reject") reasons.push("educator-rejection");
  }
  if (expected.size === 0 || seen.size !== expected.size) reasons.push("review-incomplete");
  return Object.freeze({
    status: reasons.length === 0 ? "approved" : "blocked",
    reasons: Object.freeze([...new Set(reasons)]),
    reviewed: seen.size,
    required: expected.size,
    rolloutAuthorized: false,
  });
}
