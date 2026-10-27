import { describe, expect, it } from "vitest";
import { openOriAtomicEducatorReviewStore } from "./oriAtomicEducatorReviewStore.js";
import { openOriSqliteEvidenceArtifactRepository } from "./oriSqliteEvidenceArtifactRepository.js";
import { createOriHostContextEvidencePersistence } from "./oriHostContextEvidencePersistence.js";
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
const captured = {
  missionId: "move", missionIndex: 0, oriProposal: { action: "hint" },
  kidsBaseline: { action: "hint" },
  provenance: "ori-loopback-synthetic-mission" as const,
};
const host = {
  missionId: "move", missionIndex: 0,
  learningContext: { attempts: 2, hintsUsed: 1, learningStage: "explore" as const },
  learnerFacingExplanation: { text: "Probá mover un bloque", source: "host-rendered" as const },
};
describe("MIG-03 host context evidence persistence", () => {
  it("persists four machine artifacts from a trusted host resolver", async () => {
    const reviews = openOriAtomicEducatorReviewStore(":memory:");
    const artifacts = openOriSqliteEvidenceArtifactRepository(":memory:");
    reviews.publish("pilot", matrix);
    const digest = reviews.get("pilot")!.digest;
    const service = createOriHostContextEvidencePersistence({
      reviews, artifacts, resolveHostContext: async () => host,
    });
    const refs = await service.persist(handoff, "pilot", digest, captured);
    expect(Object.keys(refs ?? {})).toHaveLength(4);
    expect(await artifacts.find("pilot", digest, "move", "educator-rationale")).toBeNull();
    artifacts.close(); reviews.close();
  });
  it("rejects unavailable context without storing incomplete evidence", async () => {
    const reviews = openOriAtomicEducatorReviewStore(":memory:");
    const artifacts = openOriSqliteEvidenceArtifactRepository(":memory:");
    reviews.publish("pilot", matrix);
    const digest = reviews.get("pilot")!.digest;
    const service = createOriHostContextEvidencePersistence({
      reviews, artifacts, resolveHostContext: async () => null,
    });
    expect(await service.persist(handoff, "pilot", digest, captured)).toBeNull();
    expect(await artifacts.find("pilot", digest, "move", "ori-proposal")).toBeNull();
    artifacts.close(); reviews.close();
  });
});
