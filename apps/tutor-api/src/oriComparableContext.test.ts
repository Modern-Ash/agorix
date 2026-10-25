import { describe, expect, it } from "vitest";
import { KIDS_MISSION_IDS } from "@agorix/curriculum";
import { validateOriComparableContext } from "./oriComparableContext.js";

const valid = {
  fixtureId: "movement-01",
  missionId: KIDS_MISSION_IDS[1]!,
  missionIndex: 1,
  hintLevel: 2 as const,
  scriptCount: 1,
  programFingerprint: "a".repeat(64),
};
describe("Ori comparable teaching context gate", () => {
  it("accepts canonical aligned movement case", () => {
    expect(validateOriComparableContext([valid])).toEqual([valid]);
  });
  it("rejects pedagogical fixtures with no canonical Kids mission", () => {
    expect(validateOriComparableContext([{ ...valid, fixtureId: "events-01", missionIndex: 4 }])).toBeNull();
  });
  it("rejects wrong mission ID even when index is in range", () => {
    expect(validateOriComparableContext([{ ...valid, missionId: KIDS_MISSION_IDS[0]! }])).toBeNull();
  });
  it("rejects wrong hint level", () => {
    expect(validateOriComparableContext([{ ...valid, hintLevel: 3 }])).toBeNull();
  });
  it("rejects missing or malformed program fingerprint", () => {
    expect(validateOriComparableContext([{ ...valid, programFingerprint: "synthetic" }])).toBeNull();
  });
  it("rejects duplicate and empty cases", () => {
    expect(validateOriComparableContext([valid, valid])).toBeNull();
    expect(validateOriComparableContext([])).toBeNull();
  });
});
