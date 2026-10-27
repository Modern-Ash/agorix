import { describe, expect, it } from "vitest";
import { openOriAtomicEducatorReviewStore } from "./oriAtomicEducatorReviewStore.js";
import { openOriSqliteEvidenceArtifactRepository } from "./oriSqliteEvidenceArtifactRepository.js";
import { openOriScopedRenderedHintReceiptStore } from "./oriScopedRenderedHintReceiptStore.js";
import { createOriScopedReceiptEvidencePersistence } from "./oriScopedReceiptEvidencePersistence.js";
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
const receipt = {
  missionId: "move", missionIndex: 0, actuallyRendered: true,
  hint: {
    schema: "agorix/pedagogical-text-hint/v1" as const,
    hint: "Probá mover un bloque hacia adelante",
    nextStep: "Revisá qué ocurre al ejecutar",
    appliedChanges: false as const,
  },
  learningContext: { attempts: 2, hintsUsed: 1, learningStage: "explore" as const },
};
describe("MIG-03 scoped receipt to SQLite evidence", () => {
  it("persists four machine artifacts only with matching scoped receipt", async () => {
    const reviews = openOriAtomicEducatorReviewStore(":memory:");
    const artifacts = openOriSqliteEvidenceArtifactRepository(":memory:");
    const receipts = openOriScopedRenderedHintReceiptStore(":memory:");
    reviews.publish("pilot", matrix);
    const digest = reviews.get("pilot")!.digest;
    expect(receipts.recordFromHost("pilot", digest, receipt)).toBe(true);
    const service = createOriScopedReceiptEvidencePersistence({ reviews, artifacts, receipts });
    expect(Object.keys(await service.persist(handoff, "pilot", digest, captured) ?? {}))
      .toHaveLength(4);
    expect(await artifacts.find("pilot", digest, "move", "educator-rationale")).toBeNull();
    artifacts.close(); receipts.close(); reviews.close();
  });
  it("rejects receipts from a different review or digest", async () => {
    const reviews = openOriAtomicEducatorReviewStore(":memory:");
    const artifacts = openOriSqliteEvidenceArtifactRepository(":memory:");
    const receipts = openOriScopedRenderedHintReceiptStore(":memory:");
    reviews.publish("pilot", matrix);
    const digest = reviews.get("pilot")!.digest;
    receipts.recordFromHost("other", digest, receipt);
    const service = createOriScopedReceiptEvidencePersistence({ reviews, artifacts, receipts });
    expect(await service.persist(handoff, "pilot", digest, captured)).toBeNull();
    expect(await artifacts.find("pilot", digest, "move", "ori-proposal")).toBeNull();
    artifacts.close(); receipts.close(); reviews.close();
  });
});
