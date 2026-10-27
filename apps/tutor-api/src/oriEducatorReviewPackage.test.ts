import { describe, expect, it } from "vitest";
import { createOriEducatorReviewPackage } from "./oriEducatorReviewPackage.js";
import type { OriMissionDivergenceMatrix } from "./oriMissionDivergenceMatrix.js";

const matrix: OriMissionDivergenceMatrix = {
  total: 3,
  available: 2,
  missing: 1,
  divergent: 1,
  rows: [
    {
      missionId: "a",
      missionIndex: 0,
      status: "missing",
      matches: 0,
      divergences: 0,
      notComparable: 0,
    },
    {
      missionId: "b",
      missionIndex: 1,
      status: "divergent",
      matches: 1,
      divergences: 1,
      notComparable: 2,
    },
    {
      missionId: "c",
      missionIndex: 2,
      status: "partial-match",
      matches: 2,
      divergences: 0,
      notComparable: 2,
    },
  ],
};
describe("Ori MIG-03 educator review package", () => {
  it("prioritizes missing evidence and technical divergences", () => {
    const review = createOriEducatorReviewPackage(matrix);
    expect(review.reviewItems.map((item) => item.reason)).toEqual([
      "missing-evidence",
      "technical-divergence",
      "semantic-gap",
    ]);
    expect(review.reviewItems.map((item) => item.priority)).toEqual(["high", "high", "normal"]);
    expect(review.reviewItems.every((item) => item.educatorDecision === "pending")).toBe(true);
    expect(review.pedagogicalApproval).toBe(false);
    expect(review.evidenceQuality.status).toBe("incomplete");
  });
});
