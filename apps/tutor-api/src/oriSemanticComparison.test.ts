import { describe, expect, it } from "vitest";
import { compareOriSemanticProjections } from "./oriSemanticComparison.js";
import type { OriSemanticProjection } from "./oriSemanticProjection.js";

const legacy: OriSemanticProjection = {
  source: "legacy-action",
  actionFamily: "movement",
  reviewRequired: true,
  mutatesProgram: false,
  pedagogicalHintLevel: null,
};
const ori: OriSemanticProjection = {
  source: "ori-plan",
  actionFamily: "unknown",
  reviewRequired: false,
  mutatesProgram: false,
  pedagogicalHintLevel: 2,
};
describe("Ori MIG-03 semantic compatibility comparison", () => {
  it("does not invent action or hint-level equivalence", () => {
    const result = compareOriSemanticProjections(legacy, ori);
    expect(result.fields).toEqual([
      { field: "actionFamily", status: "not-comparable" },
      { field: "reviewRequired", status: "divergence" },
      { field: "mutatesProgram", status: "match" },
      { field: "pedagogicalHintLevel", status: "not-comparable" },
    ]);
    expect(result.comparableFields).toBe(2);
    expect(result.matchRate).toBe(0.5);
  });
  it("reports null when every field is unobservable", () => {
    const unknown = {
      ...legacy,
      actionFamily: "unknown" as const,
      reviewRequired: null,
      pedagogicalHintLevel: null,
    };
    const result = compareOriSemanticProjections(unknown, {
      ...ori,
      mutatesProgram: false,
    });
    // Program mutation remains observable on both sides.
    expect(result.comparableFields).toBe(1);
    expect(result.matchingFields).toBe(1);
  });
});
