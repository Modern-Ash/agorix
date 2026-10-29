import { describe, expect, it } from "vitest";
import { assessOriEvidenceQuality } from "./oriEvidenceQualityGate.js";
import type { OriMissionDivergenceMatrix } from "./oriMissionDivergenceMatrix.js";

const base: OriMissionDivergenceMatrix = {
  total: 1,
  available: 1,
  missing: 0,
  divergent: 1,
  rows: [
    {
      missionId: "movement-1",
      missionIndex: 0,
      status: "divergent",
      matches: 1,
      divergences: 1,
      notComparable: 2,
    },
  ],
};
describe("Ori MIG-03 technical evidence quality gate", () => {
  it("recognizes complete evidence while withholding pedagogical approval", () => {
    expect(assessOriEvidenceQuality(base)).toEqual({
      status: "complete-technical-evidence",
      coverage: 1,
      reasons: [],
      pedagogicalApproval: false,
    });
  });
  it("rejects missing and inconsistent evidence", () => {
    const result = assessOriEvidenceQuality({
      ...base,
      available: 0,
      missing: 1,
      rows: [{ ...base.rows[0]!, status: "missing" }],
    });
    expect(result.status).toBe("incomplete");
    expect(result.reasons).toContain("missing-ori-evidence");
  });
  it("rejects an empty corpus", () => {
    expect(
      assessOriEvidenceQuality({
        total: 0,
        available: 0,
        missing: 0,
        divergent: 0,
        rows: [],
      }).status,
    ).toBe("incomplete");
  });
});
