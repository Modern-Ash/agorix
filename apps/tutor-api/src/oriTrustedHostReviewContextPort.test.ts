import { describe, expect, it } from "vitest";
import { createOriTrustedHostReviewContextPort } from "./oriTrustedHostReviewContextPort.js";
import type { OriCapturedMissionSource } from "./oriSourceEvidencePersistence.js";

const captured: OriCapturedMissionSource = {
  missionId: "move", missionIndex: 0, oriProposal: { hint: "turn" },
  kidsBaseline: { hint: "move" }, provenance: "ori-loopback-synthetic-mission",
};
const value = {
  missionId: "move", missionIndex: 0,
  learningContext: { attempts: 2, hintsUsed: 1, learningStage: "explore" as const },
  learnerFacingExplanation: { text: "Probá mover un bloque", source: "host-rendered" as const },
};
describe("MIG-03 trusted host review context", () => {
  it("accepts only matching bounded host-rendered evidence", async () => {
    const port = createOriTrustedHostReviewContextPort(async () => value);
    expect(await port.resolveFor(captured)).toEqual(value);
  });
  it("rejects mismatched missions, unrendered text and invalid counts", async () => {
    const wrong = createOriTrustedHostReviewContextPort(async () =>
      ({ ...value, missionIndex: 4 }));
    expect(await wrong.resolveFor(captured)).toBeNull();
    const fabricated = createOriTrustedHostReviewContextPort(async () =>
      ({ ...value, learnerFacingExplanation: {
        text: "Synthetic", source: "generated" as "host-rendered",
      } }));
    expect(await fabricated.resolveFor(captured)).toBeNull();
    const invalid = createOriTrustedHostReviewContextPort(async () =>
      ({ ...value, learningContext: { ...value.learningContext, attempts: -1 } }));
    expect(await invalid.resolveFor(captured)).toBeNull();
  });
});
