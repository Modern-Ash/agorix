import { describe, expect, it } from "vitest";
import { planOriPedagogicalReview } from "./oriPedagogicalReviewSampling.js";
import { buildOriAutomatedTriageReport } from "./oriAutomatedPedagogicalTriage.js";
import type { OriMissionDivergenceMatrix } from "./oriMissionDivergenceMatrix.js";

const matrix: OriMissionDivergenceMatrix = {
  total: 4, available: 3, missing: 1, divergent: 1,
  rows: [
    { missionId: "missing", missionIndex: 0, status: "missing", matches: 0, divergences: 0, notComparable: 0 },
    { missionId: "divergent", missionIndex: 1, status: "divergent", matches: 1, divergences: 1, notComparable: 2 },
    { missionId: "partial", missionIndex: 2, status: "partial-match", matches: 2, divergences: 0, notComparable: 2 },
    { missionId: "match", missionIndex: 3, status: "matched-observables", matches: 4, divergences: 0, notComparable: 0 },
  ],
};
describe("MIG-03 automated technical triage", () => {
  it("classifies every mission but never assigns educational scores", () => {
    const report = buildOriAutomatedTriageReport(matrix, planOriPedagogicalReview(matrix, 1));
    expect(report.rows.map((row) => row.finding)).toEqual([
      "missing-candidate", "observable-divergence", "semantic-not-comparable", "observable-match",
    ]);
    expect(report.selected).toBe(3);
    expect(report.deferred).toBe(1);
    expect(report.rows.every((row) => row.pedagogicalScore === null)).toBe(true);
    expect(report.pedagogicalApproval).toBe(false);
    expect(report.rolloutAuthorized).toBe(false);
  });
  it("rejects incomplete or overlapping sampling plans", () => {
    const plan = planOriPedagogicalReview(matrix, 1);
    expect(() => buildOriAutomatedTriageReport(matrix, {
      ...plan, deferred: [...plan.deferred, plan.selected[0]!.missionId],
    })).toThrow("inconsistent-review-sampling");
  });
});
