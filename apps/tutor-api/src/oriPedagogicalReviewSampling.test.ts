import { describe, expect, it } from "vitest";
import { planOriPedagogicalReview } from "./oriPedagogicalReviewSampling.js";
import type { OriMissionDivergenceMatrix } from "./oriMissionDivergenceMatrix.js";

const matrix: OriMissionDivergenceMatrix = {
  total: 4, available: 3, missing: 1, divergent: 1,
  rows: [
    { missionId: "normal-b", missionIndex: 3, status: "partial-match", matches: 2, divergences: 0, notComparable: 2 },
    { missionId: "missing", missionIndex: 0, status: "missing", matches: 0, divergences: 0, notComparable: 0 },
    { missionId: "normal-a", missionIndex: 2, status: "matched-observables", matches: 4, divergences: 0, notComparable: 0 },
    { missionId: "divergent", missionIndex: 1, status: "divergent", matches: 1, divergences: 1, notComparable: 2 },
  ],
};
describe("MIG-03 risk-first review sampling", () => {
  it("always includes missing and divergent missions before normal samples", () => {
    const plan = planOriPedagogicalReview(matrix, 1);
    expect(plan.selected.map((item) => item.missionId)).toEqual([
      "missing", "divergent", "normal-a",
    ]);
    expect(plan.deferred).toEqual(["normal-b"]);
    expect(plan.mandatoryCount).toBe(2);
    expect(plan.requiresHumanReview).toBe(true);
    expect(plan.rolloutAuthorized).toBe(false);
  });
  it("is deterministic regardless of input order and rejects invalid sample limits", () => {
    const reordered = { ...matrix, rows: [...matrix.rows].reverse() };
    expect(planOriPedagogicalReview(reordered, 2).selected.map((item) => item.missionId))
      .toEqual(planOriPedagogicalReview(matrix, 2).selected.map((item) => item.missionId));
    expect(() => planOriPedagogicalReview(matrix, -1)).toThrow("invalid-sample-limit");
  });
});
