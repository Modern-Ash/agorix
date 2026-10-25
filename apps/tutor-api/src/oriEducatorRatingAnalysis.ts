import {
  oriPedagogicalDimensions,
  summarizeOriEducatorRating,
  type OriEducatorRating,
  type OriPedagogicalDimension,
} from "./oriEducatorComparison.js";
import type { OriBlindComparisonKey } from "./oriBlindComparisonPairs.js";

/**
 * Offline educator scoring analysis; does not collect or persist ratings.
 * The caller must keep source keys separate from the blinded rating UI.
 */
export interface OriEducatorSubmission {
  readonly reviewerId: string;
  readonly rating: OriEducatorRating;
}
export interface OriDimensionComparison {
  readonly dimension: OriPedagogicalDimension;
  readonly oriMean: number;
  readonly deterministicMean: number;
  readonly difference: number;
}
export interface OriFixtureComparison {
  readonly fixtureId: string;
  readonly reviewerCount: number;
  readonly safetyFlag: boolean;
  readonly oriMean: number;
  readonly deterministicMean: number;
  readonly difference: number;
  readonly dimensions: readonly OriDimensionComparison[];
}
export function compareOriEducatorRatings(
  key: OriBlindComparisonKey,
  submissions: readonly OriEducatorSubmission[],
): OriFixtureComparison | null {
  if (!/^[a-z0-9-]{1,64}$/.test(key.fixtureId) || key.oriCandidate === key.deterministicCandidate)
    return null;
  if (submissions.length === 0 || submissions.length > 100) return null;
  const reviewers = new Map<string, { A?: OriEducatorRating; B?: OriEducatorRating }>();
  for (const submission of submissions) {
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(submission.reviewerId)) return null;
    const rating = submission.rating;
    if (rating.fixtureId !== key.fixtureId || !summarizeOriEducatorRating(rating)) return null;
    const entry = reviewers.get(submission.reviewerId) ?? {};
    if (entry[rating.candidate]) return null;
    entry[rating.candidate] = rating;
    reviewers.set(submission.reviewerId, entry);
  }
  if ([...reviewers.values()].some((ratings) => !ratings.A || !ratings.B)) return null;
  const all = [...reviewers.values()];
  const ori = all.map((ratings) => ratings[key.oriCandidate]!);
  const deterministic = all.map((ratings) => ratings[key.deterministicCandidate]!);
  const mean = (values: readonly number[]) =>
    values.reduce((sum, value) => sum + value, 0) / values.length;
  const dimensions = oriPedagogicalDimensions.map((dimension) => {
    const oriMean = mean(ori.map((rating) => rating.scores[dimension]));
    const deterministicMean = mean(deterministic.map((rating) => rating.scores[dimension]));
    return Object.freeze({
      dimension,
      oriMean,
      deterministicMean,
      difference: oriMean - deterministicMean,
    });
  });
  const oriMean = mean(ori.map((rating) => summarizeOriEducatorRating(rating)!.meanScore));
  const deterministicMean = mean(
    deterministic.map((rating) => summarizeOriEducatorRating(rating)!.meanScore),
  );
  return Object.freeze({
    fixtureId: key.fixtureId,
    reviewerCount: reviewers.size,
    safetyFlag: submissions.some((submission) => submission.rating.unsafe),
    oriMean,
    deterministicMean,
    difference: oriMean - deterministicMean,
    dimensions: Object.freeze(dimensions),
  });
}
