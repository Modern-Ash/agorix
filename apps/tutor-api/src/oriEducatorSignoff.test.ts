import { describe, expect, it } from "vitest";
import { createOriEducatorReviewPackage } from "./oriEducatorReviewPackage.js";
import { assessOriEducatorSignoff } from "./oriEducatorSignoff.js";

const matrix = {
  total: 2,
  available: 2,
  missing: 0,
  divergent: 1,
  rows: [
    {
      missionId: "a",
      missionIndex: 0,
      status: "divergent" as const,
      matches: 1,
      divergences: 1,
      notComparable: 2,
    },
    {
      missionId: "b",
      missionIndex: 1,
      status: "partial-match" as const,
      matches: 2,
      divergences: 0,
      notComparable: 2,
    },
  ],
};
const review = createOriEducatorReviewPackage(matrix);
const decisions = [
  {
    missionId: "a",
    decision: "approve" as const,
    reviewerId: "educator-1",
    rationale: "La propuesta mantiene la revisión humana.",
  },
  {
    missionId: "b",
    decision: "approve" as const,
    reviewerId: "educator-1",
    rationale: "El alumno conserva control del programa.",
  },
];
describe("Ori MIG-03 educator signoff gate", () => {
  it("requires complete, reasoned decisions without authorizing rollout", () => {
    expect(assessOriEducatorSignoff(review, decisions)).toMatchObject({
      status: "approved",
      reviewed: 2,
      required: 2,
      rolloutAuthorized: false,
    });
  });
  it("blocks missing, duplicate or rejected decisions", () => {
    expect(assessOriEducatorSignoff(review, decisions.slice(0, 1)).status).toBe("blocked");
    expect(assessOriEducatorSignoff(review, [...decisions, decisions[0]!]).status).toBe("blocked");
    expect(
      assessOriEducatorSignoff(review, [{ ...decisions[0]!, decision: "reject" }, decisions[1]!])
        .status,
    ).toBe("blocked");
  });
  it("never accepts incomplete technical evidence", () => {
    const incomplete = createOriEducatorReviewPackage({
      total: 1,
      available: 0,
      missing: 1,
      divergent: 0,
      rows: [
        {
          missionId: "a",
          missionIndex: 0,
          status: "missing",
          matches: 0,
          divergences: 0,
          notComparable: 0,
        },
      ],
    });
    expect(assessOriEducatorSignoff(incomplete, [decisions[0]!]).status).toBe("blocked");
  });
});
