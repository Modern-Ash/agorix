import { describe, expect, it } from "vitest";
import { KIDS_MISSION_IDS } from "@agorix/curriculum";
import {
  createOriSharedPedagogicalContexts,
  validateOriSharedPedagogicalContext,
} from "./oriSharedPedagogicalContext.js";

describe("Ori shared synthetic pedagogical context", () => {
  it("derives canonical context for every actual Kids mission", () => {
    const contexts = createOriSharedPedagogicalContexts();
    expect(contexts).toHaveLength(KIDS_MISSION_IDS.length);
    expect(contexts.map((context) => context.missionId)).toEqual([...KIDS_MISSION_IDS]);
    expect(contexts.every((context) => validateOriSharedPedagogicalContext(context) !== null)).toBe(
      true,
    );
  });
  it("does not include child identifiers, program source or prompt text", () => {
    const serialized = JSON.stringify(createOriSharedPedagogicalContexts());
    expect(serialized).not.toContain("childId");
    expect(serialized).not.toContain("programSource");
    expect(serialized).not.toContain("prompt");
    expect(serialized).not.toContain("scripts");
  });
  it("rejects mismatched canonical mission IDs", () => {
    const context = createOriSharedPedagogicalContexts()[0]!;
    expect(validateOriSharedPedagogicalContext({ ...context, missionId: "unknown" })).toBeNull();
  });
  it("rejects unexpected fields", () => {
    const context = createOriSharedPedagogicalContexts()[0]!;
    expect(validateOriSharedPedagogicalContext({ ...context, childId: "synthetic" })).toBeNull();
  });
  it("rejects invalid fingerprint and hint level", () => {
    const context = createOriSharedPedagogicalContexts()[0]!;
    expect(
      validateOriSharedPedagogicalContext({ ...context, programFingerprint: "not-a-hash" }),
    ).toBeNull();
    expect(validateOriSharedPedagogicalContext({ ...context, hintLevel: 6 })).toBeNull();
  });
  it("rejects invalid generation levels", () => {
    expect(() => createOriSharedPedagogicalContexts(6 as 1 | 2 | 3 | 4 | 5)).toThrow();
  });
  it("produces deterministic frozen contexts", () => {
    expect(createOriSharedPedagogicalContexts()).toEqual(createOriSharedPedagogicalContexts());
    expect(Object.isFrozen(createOriSharedPedagogicalContexts()[0])).toBe(true);
  });
});
