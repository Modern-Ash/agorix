import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION } from "@agorix/program-model";
import type { ProjectRepository } from "@agorix/project-repository";
import { createOriCanonicalReviewWorkflow } from "./oriCanonicalReviewWorkflow.js";
import type { OriHostEvidenceResult } from "./oriHostEvidenceAdapter.js";
const revision = "a".repeat(64);
const record = {
  ownerId: "student",
  projectId: "project-a",
  revision: 1,
  semanticHash: revision,
  storedProject: {
    program: {
      schema: SCHEMA_VERSION,
      scripts: [
        { id: "main", trigger: { type: "onStart" }, statements: [{ type: "move", steps: 1 }] },
      ],
    },
  },
};
const response: OriHostEvidenceResult = {
  status: "ready",
  requiresLearnerApproval: true,
  appliedChanges: false,
  proposal: {
    schemaVersion: "ori/proposal/v0",
    operation: "append",
    requiresLearnerApproval: true,
    blocks: [{ kind: "move", steps: 1 }],
  },
  evidenceReceipt: { programRevision: revision, digest: "b".repeat(64), complete: true },
};
describe("Ori review auxiliary binding lifecycle", () => {
  it("returns a review ticket for a canonical authorized project", async () => {
    const repository = { get: async () => record } as unknown as ProjectRepository;
    const workflow = createOriCanonicalReviewWorkflow({
      repository,
      oriRoot: "/unused",
      world: {},
      learningContext: async () => ({ attempts: 1, hintsUsed: 1, learningStage: "connect" }),
      runOriOverride: async () => response,
    });
    const ticket = await workflow.propose("student", "project-a");
    expect(ticket?.status).toBe("pending");
    expect((await workflow.decide("student", "project-a", ticket!.id, "reject"))?.status).toBe(
      "rejected",
    );
  });
});
