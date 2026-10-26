import { describe, expect, it } from "vitest";
import { createOriSharedPedagogicalContexts } from "./oriSharedPedagogicalContext.js";
import { separateOriEvaluationContext } from "./oriNeutralEvaluationContext.js";

describe("Ori neutral evaluation context separation", () => {
  it("separates every canonical synthetic mission", () => {
    const contexts = createOriSharedPedagogicalContexts();
    for (const context of contexts) {
      const separated = separateOriEvaluationContext(context);
      expect(separated?.neutral.missionId).toBe(context.missionId);
      expect(separated?.neutral.programFingerprint).toBe(context.programFingerprint);
      expect(separated?.evidence.deterministicKind).toBe(context.deterministicKind);
    }
  });
  it("never leaks the deterministic outcome into neutral metadata", () => {
    const context = createOriSharedPedagogicalContexts()[0]!;
    const result = separateOriEvaluationContext(context);
    expect(Object.keys(result!.neutral).sort()).toEqual([
      "hintLevel",
      "missionId",
      "missionIndex",
      "programFingerprint",
      "schema",
      "scriptCount",
    ]);
    expect(JSON.stringify(result!.neutral)).not.toContain("deterministicKind");
    expect(JSON.stringify(result!.neutral)).not.toContain("deterministic-evidence");
  });
  it("rejects arbitrary extra fields or learner identifiers", () => {
    const context = createOriSharedPedagogicalContexts()[0]!;
    expect(separateOriEvaluationContext({ ...context, childId: "synthetic" })).toBeNull();
  });
  it("rejects invalid canonical mission evidence", () => {
    const context = createOriSharedPedagogicalContexts()[0]!;
    expect(separateOriEvaluationContext({ ...context, missionId: "unknown" })).toBeNull();
  });
  it("returns frozen evidence and neutral records", () => {
    const result = separateOriEvaluationContext(createOriSharedPedagogicalContexts()[0]);
    expect(Object.isFrozen(result?.neutral)).toBe(true);
    expect(Object.isFrozen(result?.evidence)).toBe(true);
  });
});
