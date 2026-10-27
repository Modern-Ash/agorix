import { describe, expect, it } from "vitest";
import { openOriAtomicEducatorReviewStore } from "./oriAtomicEducatorReviewStore.js";
import { openOriSqliteEvidenceArtifactRepository } from "./oriSqliteEvidenceArtifactRepository.js";
import { createOriTrustedReviewEvidenceCapture } from "./oriTrustedReviewEvidenceCapture.js";
import { createOriPersistedEvidenceReferenceVerifier } from "./oriPersistedEvidenceReferenceVerifier.js";
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
    requiredEvidence: ["ori-proposal", "kids-baseline"] }],
  deferredMissionIds: [], unresolvedMissionIds: [],
  nextAction: "educator-review-required", formalApproval: false, rolloutAuthorized: false,
};
describe("MIG-03 trusted review evidence capture", () => {
  it("persists required evidence and returns verifiable artifact references", async () => {
    const reviews = openOriAtomicEducatorReviewStore(":memory:");
    const artifacts = openOriSqliteEvidenceArtifactRepository(":memory:");
    reviews.publish("pilot", matrix);
    const state = reviews.get("pilot")!;
    const refs = createOriTrustedReviewEvidenceCapture(reviews, artifacts).capture(handoff, {
      reviewId: "pilot", evidenceDigest: state.digest, missionId: "move",
      artifacts: { "ori-proposal": Buffer.from("Ori plan"),
        "kids-baseline": Buffer.from("Kids baseline") },
    });
    expect(refs).not.toBeNull();
    expect(await createOriPersistedEvidenceReferenceVerifier(artifacts).verify(
      "pilot", state.digest, "move", refs!)).toBe(true);
    artifacts.close(); reviews.close();
  });
  it("rejects stale digest and incomplete evidence without persisting", () => {
    const reviews = openOriAtomicEducatorReviewStore(":memory:");
    const artifacts = openOriSqliteEvidenceArtifactRepository(":memory:");
    reviews.publish("pilot", matrix);
    const state = reviews.get("pilot")!;
    const capture = createOriTrustedReviewEvidenceCapture(reviews, artifacts);
    expect(capture.capture(handoff, {
      reviewId: "pilot", evidenceDigest: "a".repeat(64), missionId: "move",
      artifacts: { "ori-proposal": Buffer.from("Ori"), "kids-baseline": Buffer.from("Kids") },
    })).toBeNull();
    expect(capture.capture(handoff, {
      reviewId: "pilot", evidenceDigest: state.digest, missionId: "move",
      artifacts: { "ori-proposal": Buffer.from("Ori") },
    })).toBeNull();
    expect(await artifacts.find("pilot", state.digest, "move", "ori-proposal")).toBeNull();
    artifacts.close(); reviews.close();
  });
});
