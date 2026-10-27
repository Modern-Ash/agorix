import { describe, expect, it } from "vitest";
import { assessOriMig03Readiness } from "./oriMig03Readiness.js";

const matrix = {
  total: 1, available: 1, missing: 0, divergent: 0,
  rows: [{ missionId: "movement", missionIndex: 0, status: "matched-observables" as const,
    matches: 4, divergences: 0, notComparable: 0 }],
};
const decisions = [{
  missionId: "movement", decision: "approve" as const, reviewerId: "educator",
  rationale: "Se revisó la intención educativa y el control del alumno.",
}];
describe("Ori MIG-03 acceptance readiness", () => {
  it("requires complete evidence, provenance and human decisions", () => {
    expect(assessOriMig03Readiness(matrix, decisions, true)).toEqual({
      status: "ready-for-human-acceptance", reasons: [],
      technicalCoverage: 1, educatorReviewed: 1, educatorRequired: 1,
      rolloutAuthorized: false,
    });
    expect(assessOriMig03Readiness(matrix, decisions, false).reasons)
      .toContain("unverified-evidence-provenance");
    expect(assessOriMig03Readiness(matrix, [], true).status).toBe("blocked");
  });
  it("blocks unresolved semantic gaps even if technical matches exist", () => {
    expect(assessOriMig03Readiness({
      ...matrix, rows: [{ ...matrix.rows[0]!, status: "partial-match", notComparable: 2 }],
    }, decisions, true).reasons).toContain("semantic-gaps-require-adjudication");
  });
});
