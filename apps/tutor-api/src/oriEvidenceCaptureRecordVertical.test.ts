import { describe, expect, it } from "vitest";
import { openOriAtomicEducatorReviewStore } from "./oriAtomicEducatorReviewStore.js";
import { openOriSqliteEvidenceArtifactRepository } from "./oriSqliteEvidenceArtifactRepository.js";
import { createOriTrustedReviewEvidenceCapture } from "./oriTrustedReviewEvidenceCapture.js";
import { createOriArtifactBackedReviewService } from "./oriArtifactBackedReviewService.js";
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
    requiredEvidence: ["ori-proposal", "kids-baseline", "learning-context",
      "learner-facing-explanation", "educator-rationale"] }],
  deferredMissionIds: [], unresolvedMissionIds: [],
  nextAction: "educator-review-required", formalApproval: false, rolloutAuthorized: false,
};
describe("MIG-03 trusted evidence capture to educator decision vertical", () => {
  it("captures complete host evidence then records a reasoned decision with CAS", async () => {
    const reviews = openOriAtomicEducatorReviewStore(":memory:");
    const artifacts = openOriSqliteEvidenceArtifactRepository(":memory:");
    reviews.publish("pilot", matrix);
    const state = reviews.get("pilot")!;
    const refs = createOriTrustedReviewEvidenceCapture(reviews, artifacts).capture(handoff, {
      reviewId: "pilot", evidenceDigest: state.digest, missionId: "move",
      artifacts: {
        "ori-proposal": Buffer.from("Synthetic Ori proposal"),
        "kids-baseline": Buffer.from("Synthetic Kids baseline"),
        "learning-context": Buffer.from("Synthetic learning context"),
        "learner-facing-explanation": Buffer.from("Synthetic explanation"),
        "educator-rationale": Buffer.from("Synthetic educator rationale"),
      },
    });
    expect(refs).not.toBeNull();
    const service = createOriArtifactBackedReviewService({
      reviews, artifacts, authorize: async () => ({ id: "educator", canReviewOri: true }),
      resolveHandoff: async () => ({ evidenceDigest: state.digest, handoff }),
    });
    const submission = {
      missionId: "move", reviewerId: "educator", disposition: "approve" as const,
      rationale: "La propuesta mantiene autonomía y claridad conceptual.",
      evidenceRefs: refs!,
    };
    expect(await service.record({}, "pilot", state.digest, state.revision, submission))
      .toBe("recorded");
    expect(await service.record({}, "pilot", state.digest, state.revision, submission))
      .toBe("conflict");
    expect(reviews.decisions("pilot")).toHaveLength(1);
    expect(reviews.signoff("pilot")?.rolloutAuthorized).toBe(false);
    artifacts.close(); reviews.close();
  });
  it("blocks incomplete capture and never records fabricated evidence", async () => {
    const reviews = openOriAtomicEducatorReviewStore(":memory:");
    const artifacts = openOriSqliteEvidenceArtifactRepository(":memory:");
    reviews.publish("pilot", matrix);
    const state = reviews.get("pilot")!;
    const refs = createOriTrustedReviewEvidenceCapture(reviews, artifacts).capture(handoff, {
      reviewId: "pilot", evidenceDigest: state.digest, missionId: "move",
      artifacts: { "ori-proposal": Buffer.from("incomplete") },
    });
    expect(refs).toBeNull();
    const service = createOriArtifactBackedReviewService({
      reviews, artifacts, authorize: async () => ({ id: "educator", canReviewOri: true }),
      resolveHandoff: async () => ({ evidenceDigest: state.digest, handoff }),
    });
    expect(await service.record({}, "pilot", state.digest, state.revision, {
      missionId: "move", reviewerId: "educator", disposition: "approve",
      rationale: "Evaluación educativa documentada",
      evidenceRefs: { "ori-proposal": "artifact:missing" },
    })).toBe("invalid");
    expect(reviews.decisions("pilot")).toHaveLength(0);
    artifacts.close(); reviews.close();
  });
});
