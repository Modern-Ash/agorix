import { describe, expect, it } from "vitest";
import { openOriAtomicEducatorReviewStore } from "./oriAtomicEducatorReviewStore.js";
import { openOriSqliteEvidenceArtifactRepository } from "./oriSqliteEvidenceArtifactRepository.js";
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
    requiredEvidence: ["ori-proposal", "educator-rationale"] }],
  deferredMissionIds: [], unresolvedMissionIds: [],
  nextAction: "educator-review-required", formalApproval: false, rolloutAuthorized: false,
};
describe("MIG-03 artifact-backed educator recording", () => {
  it("persists only decisions backed by immutable verified SQLite artifacts", async () => {
    const reviews = openOriAtomicEducatorReviewStore(":memory:");
    const artifacts = openOriSqliteEvidenceArtifactRepository(":memory:");
    reviews.publish("pilot", matrix);
    const state = reviews.get("pilot")!;
    const proposal = artifacts.put("pilot", state.digest, "move", "ori-proposal",
      Buffer.from("Synthetic Ori proposal"));
    const rationale = artifacts.put("pilot", state.digest, "move", "educator-rationale",
      Buffer.from("Educator reviewed autonomy and conceptual clarity"));
    const service = createOriArtifactBackedReviewService({
      reviews, artifacts, authorize: async () => ({ id: "educator", canReviewOri: true }),
      resolveHandoff: async () => ({ evidenceDigest: state.digest, handoff }),
    });
    const submission = {
      missionId: "move", reviewerId: "educator", disposition: "approve" as const,
      rationale: "La intervención mantiene el control del alumno.",
      evidenceRefs: {
        "ori-proposal": proposal!.reference,
        "educator-rationale": rationale!.reference,
      },
    };
    expect(await service.record({}, "pilot", state.digest, state.revision, submission))
      .toBe("recorded");
    expect(await service.record({}, "pilot", state.digest, state.revision, submission))
      .toBe("conflict");
    expect(reviews.decisions("pilot")).toHaveLength(1);
    artifacts.close(); reviews.close();
  });
  it("rejects references not present in the trusted artifact store", async () => {
    const reviews = openOriAtomicEducatorReviewStore(":memory:");
    const artifacts = openOriSqliteEvidenceArtifactRepository(":memory:");
    reviews.publish("pilot", matrix);
    const state = reviews.get("pilot")!;
    const service = createOriArtifactBackedReviewService({
      reviews, artifacts, authorize: async () => ({ id: "educator", canReviewOri: true }),
      resolveHandoff: async () => ({ evidenceDigest: state.digest, handoff }),
    });
    expect(await service.record({}, "pilot", state.digest, state.revision, {
      missionId: "move", reviewerId: "educator", disposition: "approve",
      rationale: "Evaluación pedagógica documentada",
      evidenceRefs: { "ori-proposal": "artifact:missing", "educator-rationale": "artifact:missing" },
    })).toBe("invalid");
    expect(reviews.decisions("pilot")).toHaveLength(0);
    artifacts.close(); reviews.close();
  });
});
