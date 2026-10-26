import { describe, expect, it } from "vitest";
import { buildOriParityReport } from "./oriParityReport.js";
import type { OriGoldenCase } from "./oriGoldenParity.js";

const base: OriGoldenCase = {
  caseId: "one",
  contextDigest: "a".repeat(64),
  legacy: { kind: "hint", hintLevel: 2 },
  ori: { kind: "hint", hintLevel: 2 },
};
describe("Ori MIG-03 parity evidence report", () => {
  it("counts missing responses separately from comparable cases", () => {
    const report = buildOriParityReport([
      base,
      { ...base, caseId: "two", ori: null },
      { ...base, caseId: "three", ori: { kind: "refusal", hintLevel: 2 } },
      { ...base, caseId: "four", contextDigest: "invalid" },
    ]);
    expect(report.total).toBe(4);
    expect(report.comparable).toBe(2);
    expect(report.exactMatches).toBe(1);
    expect(report.exactMatchRate).toBe(0.5);
    expect(report.counts["missing-ori"]).toBe(1);
    expect(report.counts["invalid-context"]).toBe(1);
  });
  it("does not claim parity when the dataset is empty or entirely missing", () => {
    expect(buildOriParityReport([]).exactMatchRate).toBeNull();
    expect(buildOriParityReport([{ ...base, ori: null }]).exactMatchRate).toBeNull();
  });
});
