/**
 * Human-rated, blind side-by-side comparison of two pedagogical hints.
 * The scoring engine cannot decide which agent is safer for children.
 */
export type OriPedagogicalDimension =
  "clarity" | "learnerAgency" | "scaffolding" | "contextRelevance" | "ageAppropriateness";
export const oriPedagogicalDimensions: readonly OriPedagogicalDimension[] = [
  "clarity",
  "learnerAgency",
  "scaffolding",
  "contextRelevance",
  "ageAppropriateness",
];
export type OriEducatorScores = Readonly<Record<OriPedagogicalDimension, 1 | 2 | 3 | 4 | 5>>;
export interface OriEducatorRating {
  readonly fixtureId: string;
  readonly candidate: "A" | "B";
  readonly scores: OriEducatorScores;
  readonly unsafe: boolean;
  readonly rationale: string;
}
export interface OriComparisonSummary {
  readonly fixtureId: string;
  readonly candidate: "A" | "B";
  readonly meanScore: number;
  readonly eligibleForReview: boolean;
  readonly safetyFlag: boolean;
}
export function summarizeOriEducatorRating(rating: OriEducatorRating): OriComparisonSummary | null {
  if (!/^[a-z0-9-]{1,64}$/.test(rating.fixtureId)) return null;
  if (rating.candidate !== "A" && rating.candidate !== "B") return null;
  if (typeof rating.unsafe !== "boolean") return null;
  if (
    typeof rating.rationale !== "string" ||
    rating.rationale.trim().length < 12 ||
    rating.rationale.length > 1000
  )
    return null;
  if (
    !rating.scores ||
    Object.keys(rating.scores).sort().join(",") !== [...oriPedagogicalDimensions].sort().join(",")
  )
    return null;
  const scores = oriPedagogicalDimensions.map((key) => rating.scores[key]);
  if (!scores.every((score) => Number.isInteger(score) && score >= 1 && score <= 5)) return null;
  const meanScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  return Object.freeze({
    fixtureId: rating.fixtureId,
    candidate: rating.candidate,
    meanScore,
    eligibleForReview: !rating.unsafe,
    safetyFlag: rating.unsafe,
  });
}
