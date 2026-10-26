import { describe, expect, it } from "vitest";
import { buildOriEducatorOfflineReport } from "./oriEducatorOfflineReport.js";
import type { OriEducatorSubmission } from "./oriEducatorRatingAnalysis.js";

function submission(
  fixtureId: string,
  candidate: "A" | "B",
  score: 1 | 2 | 3 | 4 | 5,
  unsafe = false,
): OriEducatorSubmission {
  return {
    reviewerId: "educator1",
    rating: {
      fixtureId,
      candidate,
      scores: {
        clarity: score,
        learnerAgency: score,
        scaffolding: score,
        contextRelevance: score,
        ageAppropriateness: score,
      },
      unsafe,
      rationale: "Evaluación sintética explicada con criterios pedagógicos.",
    },
  };
}
const keys = [
  { fixtureId: "movement-01", oriCandidate: "A" as const, deterministicCandidate: "B" as const },
  { fixtureId: "loops-01", oriCandidate: "B" as const, deterministicCandidate: "A" as const },
];
const submissions = [
  submission("movement-01", "A", 5),
  submission("movement-01", "B", 3),
  submission("loops-01", "A", 2),
  submission("loops-01", "B", 4),
];
describe("Ori educator offline report", () => {
  it("builds paired fixture comparisons with source-key reversal", () => {
    const report = buildOriEducatorOfflineReport({ keys, submissions });
    expect(report?.fixtureCount).toBe(2);
    expect(report?.totalPairedReviews).toBe(2);
    expect(report?.fixtures.map((fixture) => fixture.difference)).toEqual([2, 2]);
    expect(Object.isFrozen(report?.fixtures)).toBe(true);
  });
  it("retains any safety veto in the aggregate report", () => {
    const report = buildOriEducatorOfflineReport({
      keys,
      submissions: [...submissions.slice(0, 3), submission("loops-01", "B", 4, true)],
    });
    expect(report?.safetyFlag).toBe(true);
  });
  it("rejects missing ratings for any fixture", () => {
    expect(
      buildOriEducatorOfflineReport({ keys, submissions: submissions.slice(0, 2) }),
    ).toBeNull();
  });
  it("rejects unknown fixtures instead of silently ignoring them", () => {
    expect(
      buildOriEducatorOfflineReport({
        keys,
        submissions: [...submissions, submission("events-01", "A", 4)],
      }),
    ).toBeNull();
  });
  it("rejects duplicate source keys", () => {
    expect(buildOriEducatorOfflineReport({ keys: [keys[0]!, keys[0]!], submissions })).toBeNull();
  });
  it("rejects incomplete pairs", () => {
    expect(
      buildOriEducatorOfflineReport({ keys, submissions: submissions.slice(0, 3) }),
    ).toBeNull();
  });
});
