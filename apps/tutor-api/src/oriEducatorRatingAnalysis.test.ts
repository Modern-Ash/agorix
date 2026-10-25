import { describe, expect, it } from "vitest";
import { compareOriEducatorRatings } from "./oriEducatorRatingAnalysis.js";
import type { OriEducatorSubmission } from "./oriEducatorRatingAnalysis.js";
import type { OriBlindComparisonKey } from "./oriBlindComparisonPairs.js";

const key: OriBlindComparisonKey = {
  fixtureId: "movement-01",
  oriCandidate: "A",
  deterministicCandidate: "B",
};
function rating(
  reviewerId: string,
  candidate: "A" | "B",
  score: 1 | 2 | 3 | 4 | 5,
  unsafe = false,
): OriEducatorSubmission {
  return {
    reviewerId,
    rating: {
      fixtureId: "movement-01",
      candidate,
      scores: {
        clarity: score,
        learnerAgency: score,
        scaffolding: score,
        contextRelevance: score,
        ageAppropriateness: score,
      },
      unsafe,
      rationale: "Evaluación sintética explicada para la comparación.",
    },
  };
}
describe("Ori paired educator rating analysis", () => {
  it("compares complete blind A/B ratings by dimension", () => {
    const result = compareOriEducatorRatings(key, [
      rating("reviewer1", "A", 5),
      rating("reviewer1", "B", 3),
      rating("reviewer2", "A", 4),
      rating("reviewer2", "B", 2),
    ]);
    expect(result).toMatchObject({
      fixtureId: "movement-01",
      reviewerCount: 2,
      oriMean: 4.5,
      deterministicMean: 2.5,
      difference: 2,
      safetyFlag: false,
    });
    expect(result?.dimensions).toHaveLength(5);
    expect(result?.dimensions[0]?.difference).toBe(2);
  });
  it("handles reversed A/B assignment", () => {
    const reverse = { ...key, oriCandidate: "B" as const, deterministicCandidate: "A" as const };
    expect(
      compareOriEducatorRatings(reverse, [rating("reviewer1", "A", 5), rating("reviewer1", "B", 3)])
        ?.difference,
    ).toBe(-2);
  });
  it("propagates safety flags regardless of numeric score", () => {
    expect(
      compareOriEducatorRatings(key, [
        rating("reviewer1", "A", 5, true),
        rating("reviewer1", "B", 3),
      ])?.safetyFlag,
    ).toBe(true);
  });
  it("rejects incomplete reviewer pairs", () => {
    expect(compareOriEducatorRatings(key, [rating("reviewer1", "A", 5)])).toBeNull();
  });
  it("rejects duplicate reviewer ratings", () => {
    expect(
      compareOriEducatorRatings(key, [
        rating("reviewer1", "A", 5),
        rating("reviewer1", "A", 4),
        rating("reviewer1", "B", 3),
      ]),
    ).toBeNull();
  });
  it("rejects invalid fixture and empty input", () => {
    expect(compareOriEducatorRatings(key, [])).toBeNull();
    expect(
      compareOriEducatorRatings({ ...key, fixtureId: "other" }, [
        rating("reviewer1", "A", 5),
        rating("reviewer1", "B", 3),
      ]),
    ).toBeNull();
  });
});
