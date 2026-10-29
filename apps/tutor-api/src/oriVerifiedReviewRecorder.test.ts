import { describe, expect, it } from "vitest";
import { openOriAtomicEducatorReviewStore } from "./oriAtomicEducatorReviewStore.js";
import { createOriVerifiedReviewRecorder } from "./oriVerifiedReviewRecorder.js";
import type { OriMig03ReviewHandoff } from "./oriMig03ReviewHandoff.js";

const matrix = {
  total: 1,
  available: 1,
  missing: 0,
  divergent: 0,
  rows: [
    {
      missionId: "move",
      missionIndex: 0,
      status: "matched-observables" as const,
      matches: 4,
      divergences: 0,
      notComparable: 0,
    },
  ],
};
const handoff: OriMig03ReviewHandoff = {
  schemaVersion: "agorix/ori-mig03-review-handoff/v1",
  missionCount: 1,
  selectedForReview: 1,
  pendingEvidence: [
    {
      missionId: "move",
      status: "awaiting-human-review",
      requiredEvidence: ["ori-proposal", "educator-rationale"],
    },
  ],
  deferredMissionIds: [],
  unresolvedMissionIds: [],
  nextAction: "educator-review-required",
  formalApproval: false,
  rolloutAuthorized: false,
};
const principal = { id: "educator", canReviewOri: true };
const submission = {
  missionId: "move",
  reviewerId: "educator",
  disposition: "approve" as const,
  rationale: "La revisión pedagógica está documentada.",
  evidenceRefs: { "ori-proposal": "artifact:ori", "educator-rationale": "artifact:review" },
};
describe("MIG-03 verified review recording", () => {
  it("records verified evidence once and rejects stale revisions", async () => {
    const store = openOriAtomicEducatorReviewStore(":memory:");
    store.publish("pilot", matrix);
    const state = store.get("pilot")!;
    const recorder = createOriVerifiedReviewRecorder(store, { verify: async () => true });
    expect(
      await recorder.record("pilot", state.digest, state.revision, principal, handoff, submission),
    ).toBe("recorded");
    expect(
      await recorder.record("pilot", state.digest, state.revision, principal, handoff, submission),
    ).toBe("conflict");
    expect(store.decisions("pilot")).toHaveLength(1);
    store.close();
  });
  it("fails closed on forged identity, evidence, or unresolved missions", async () => {
    const store = openOriAtomicEducatorReviewStore(":memory:");
    store.publish("pilot", matrix);
    const state = store.get("pilot")!;
    const recorder = createOriVerifiedReviewRecorder(store, { verify: async () => false });
    expect(
      await recorder.record("pilot", state.digest, state.revision, principal, handoff, {
        ...submission,
        reviewerId: "forged",
      }),
    ).toBe("unauthorized");
    expect(
      await recorder.record("pilot", state.digest, state.revision, principal, handoff, submission),
    ).toBe("invalid");
    expect(
      await recorder.record(
        "pilot",
        state.digest,
        state.revision,
        principal,
        { ...handoff, unresolvedMissionIds: ["move"] },
        submission,
      ),
    ).toBe("invalid");
    store.close();
  });
  it("persists a reasoned rejection without granting signoff", async () => {
    const store = openOriAtomicEducatorReviewStore(":memory:");
    store.publish("pilot", matrix);
    const state = store.get("pilot")!;
    const recorder = createOriVerifiedReviewRecorder(store, { verify: async () => true });
    expect(
      await recorder.record("pilot", state.digest, state.revision, principal, handoff, {
        ...submission,
        disposition: "reject",
      }),
    ).toBe("recorded");
    expect(store.signoff("pilot")?.status).toBe("blocked");
    store.close();
  });
});
