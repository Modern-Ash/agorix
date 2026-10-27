import { describe, expect, it } from "vitest";
import { openOriAtomicEducatorReviewStore } from "./oriAtomicEducatorReviewStore.js";
import { createOriAuthorizedReviewRecordingService } from "./oriAuthorizedReviewRecordingService.js";
import type { OriMig03ReviewHandoff } from "./oriMig03ReviewHandoff.js";

const matrix = {
  total: 1, available: 1, missing: 0, divergent: 0,
  rows: [{ missionId: "move", missionIndex: 0, status: "matched-observables" as const,
    matches: 4, divergences: 0, notComparable: 0 }],
};
const handoff: OriMig03ReviewHandoff = {
  schemaVersion: "agorix/ori-mig03-review-handoff/v1",
  missionCount: 1, selectedForReview: 1,
  pendingEvidence: [{ missionId: "move", status: "awaiting-human-review",
    requiredEvidence: ["ori-proposal", "educator-rationale"] }],
  deferredMissionIds: [], unresolvedMissionIds: [],
  nextAction: "educator-review-required", formalApproval: false, rolloutAuthorized: false,
};
const submission = {
  missionId: "move", reviewerId: "educator", disposition: "approve" as const,
  rationale: "La revisión educativa está documentada.",
  evidenceRefs: { "ori-proposal": "artifact:ori", "educator-rationale": "artifact:review" },
};
describe("MIG-03 authorized verified recording composition", () => {
  it("records only a server-derived handoff for a current evidence revision", async () => {
    const store = openOriAtomicEducatorReviewStore(":memory:");
    store.publish("pilot", matrix);
    const state = store.get("pilot")!;
    const service = createOriAuthorizedReviewRecordingService(
      store, async () => ({ id: "educator", canReviewOri: true }),
      async () => ({ evidenceDigest: state.digest, handoff }),
      { verify: async () => true },
    );
    expect(await service.record({}, "pilot", state.digest, state.revision, submission))
      .toBe("recorded");
    expect(await service.record({}, "pilot", state.digest, state.revision, submission))
      .toBe("conflict");
    store.close();
  });
  it("denies revoked role, forged identity and stale handoff", async () => {
    const store = openOriAtomicEducatorReviewStore(":memory:");
    store.publish("pilot", matrix);
    const state = store.get("pilot")!;
    let reads = 0;
    const revoked = createOriAuthorizedReviewRecordingService(
      store, async () => ++reads === 1
        ? { id: "educator", canReviewOri: true } : null,
      async () => ({ evidenceDigest: state.digest, handoff }),
      { verify: async () => true },
    );
    expect(await revoked.record({}, "pilot", state.digest, state.revision, submission))
      .toBe("unauthorized");
    const stale = createOriAuthorizedReviewRecordingService(
      store, async () => ({ id: "educator", canReviewOri: true }),
      async () => ({ evidenceDigest: "a".repeat(64), handoff }),
      { verify: async () => true },
    );
    expect(await stale.record({}, "pilot", state.digest, state.revision, submission))
      .toBe("conflict");
    expect(await stale.record({}, "pilot", state.digest, state.revision,
      { ...submission, reviewerId: "forged" })).toBe("unauthorized");
    expect(store.decisions("pilot")).toHaveLength(0);
    store.close();
  });
});
