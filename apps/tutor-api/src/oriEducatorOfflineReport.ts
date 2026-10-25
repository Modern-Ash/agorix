import type { OriBlindComparisonKey } from "./oriBlindComparisonPairs.js";
import {
  compareOriEducatorRatings,
  type OriEducatorSubmission,
  type OriFixtureComparison,
} from "./oriEducatorRatingAnalysis.js";
import { summarizeOriEducatorRating } from "./oriEducatorComparison.js";

/**
 * Offline, all-or-nothing report builder. Accepts pre-collected blinded
 * ratings; no network calls, storage, or child-facing integration.
 */
export interface OriEducatorReportInput {
  readonly keys: readonly OriBlindComparisonKey[];
  readonly submissions: readonly OriEducatorSubmission[];
}
export interface OriEducatorOfflineReport {
  readonly fixtureCount: number;
  readonly totalPairedReviews: number;
  readonly safetyFlag: boolean;
  readonly fixtures: readonly OriFixtureComparison[];
}
export function buildOriEducatorOfflineReport(
  input: OriEducatorReportInput,
): OriEducatorOfflineReport | null {
  if (!input || !Array.isArray(input.keys) || !Array.isArray(input.submissions)) return null;
  if (input.keys.length < 1 || input.keys.length > 100 || input.submissions.length > 200)
    return null;
  const seen = new Set<string>();
  const fixtures: OriFixtureComparison[] = [];
  for (const key of input.keys) {
    if (!key || typeof key.fixtureId !== "string" || seen.has(key.fixtureId)) return null;
    seen.add(key.fixtureId);
    const relevant = input.submissions.filter(
      (submission) => submission?.rating?.fixtureId === key.fixtureId,
    );
    if (relevant.length === 0) return null;
    const comparison = compareOriEducatorRatings(key, relevant);
    if (!comparison) return null;
    fixtures.push(comparison);
  }
  if (
    input.submissions.some(
      (submission) =>
        !submission ||
        !submission.rating ||
        !seen.has(submission.rating.fixtureId) ||
        !summarizeOriEducatorRating(submission.rating),
    )
  )
    return null;
  return Object.freeze({
    fixtureCount: fixtures.length,
    totalPairedReviews: fixtures.reduce((total, fixture) => total + fixture.reviewerCount, 0),
    safetyFlag: fixtures.some((fixture) => fixture.safetyFlag),
    fixtures: Object.freeze(fixtures),
  });
}
