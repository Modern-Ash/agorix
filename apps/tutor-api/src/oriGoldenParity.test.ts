import { describe, expect, it } from "vitest";
import { classifyOriGoldenParity, type OriGoldenCase } from "./oriGoldenParity.js";

const base: OriGoldenCase = {
  caseId: "synthetic-1",
  contextDigest: "a".repeat(64),
  legacy: { kind: "hint", hintLevel: 2 },
  ori: { kind: "hint", hintLevel: 2 },
};
describe("Ori MIG-03 golden parity classifier", () => {
  it("classifies parity and missing Ori responses", () => {
    expect(classifyOriGoldenParity([base, { ...base, caseId: "missing", ori: null }]))
      .toEqual([
        { caseId: "synthetic-1", outcome: "parity" },
        { caseId: "missing", outcome: "missing-ori" },
      ]);
  });
  it("separates semantic and hint-level divergence", () => {
    expect(classifyOriGoldenParity([
      { ...base, ori: { kind: "refusal", hintLevel: 2 } },
      { ...base, ori: { kind: "hint", hintLevel: 3 } },
    ]).map((result) => result.outcome))
      .toEqual(["kind-divergence", "hint-level-divergence"]);
  });
  it("rejects invalid or ungrounded comparison context", () => {
    expect(classifyOriGoldenParity([{ ...base, contextDigest: "invalid" }])[0]?.outcome)
      .toBe("invalid-context");
  });
});
