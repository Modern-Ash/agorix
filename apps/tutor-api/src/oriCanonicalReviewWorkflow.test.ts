import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION } from "@agorix/program-model";
import type { ProjectRepository } from "@agorix/project-repository";
import { createOriCanonicalReviewWorkflow } from "./oriCanonicalReviewWorkflow.js";
import type { OriHostEvidenceResult, TrustedOriEvidence } from "./oriHostEvidenceAdapter.js";

const revision = "a".repeat(64);
const program = {
  schema: SCHEMA_VERSION,
  scripts: [
    {
      id: "main",
      trigger: { type: "onStart" },
      statements: [{ type: "move", steps: 1 }],
    },
  ],
};
const base = {
  ownerId: "student",
  projectId: "project-a",
  revision: 1,
  semanticHash: revision,
  storedProject: { program },
};
const response: OriHostEvidenceResult = {
  status: "ready",
  proposal: {
    schemaVersion: "ori/proposal/v0",
    operation: "append",
    requiresLearnerApproval: true,
    blocks: [{ kind: "move", steps: 1 }],
  },
  evidenceReceipt: { programRevision: revision, digest: "b".repeat(64), complete: true },
  requiresLearnerApproval: true,
  appliedChanges: false,
};
describe("canonical project -> runtime -> Ori review composition", () => {
  it("runs the persisted program and records a non-applying decision", async () => {
    let calls = 0;
    const repository = {
      get: async (owner: string, id: string) => {
        if (owner !== "student" || id !== "project-a") throw Error("denied");
        return base;
      },
    } as unknown as ProjectRepository;
    const workflow = createOriCanonicalReviewWorkflow({
      repository,
      oriRoot: "/unused-with-test-override",
      world: { goal: { x: 10, y: 0 } },
      learningContext: async () => ({ attempts: 1, hintsUsed: 1, learningStage: "connect" }),
      runOriOverride: async (raw: unknown) => {
        const evidence = raw as TrustedOriEvidence;
        calls++;
        expect(evidence.trace.steps).toEqual([{ index: 0, description: "Executed move" }]);
        expect(evidence.programRevision).toBe(revision);
        return response;
      },
    });
    const ticket = await workflow.propose("student", "project-a");
    expect(ticket?.status).toBe("pending");
    expect(calls).toBe(1);
    expect(await workflow.read("intruder", "project-a", ticket!.id)).toBeNull();
    expect((await workflow.decide("student", "project-a", ticket!.id, "accept"))?.status).toBe(
      "accepted",
    );
    expect(calls).toBe(1);
  });
  it("rejects review after repository revision changes", async () => {
    let numericRevision = 1;
    const repository = {
      get: async () => ({ ...base, revision: numericRevision }),
    } as unknown as ProjectRepository;
    const workflow = createOriCanonicalReviewWorkflow({
      repository,
      oriRoot: "/unused-with-test-override",
      world: {},
      learningContext: async () => ({ attempts: 1, hintsUsed: 1, learningStage: "connect" }),
      runOriOverride: async () => response,
    });
    const ticket = await workflow.propose("student", "project-a");
    expect(ticket).not.toBeNull();
    numericRevision = 2;
    expect((await workflow.decide("student", "project-a", ticket!.id, "accept"))?.status).toBe(
      "stale",
    );
  });
  it("rejects a changed semantic hash without a numeric revision increment", async () => {
    let semanticHash = revision;
    const repository = {
      get: async () => ({ ...base, semanticHash }),
    } as unknown as ProjectRepository;
    const workflow = createOriCanonicalReviewWorkflow({
      repository,
      oriRoot: "/unused-with-test-override",
      world: {},
      learningContext: async () => ({ attempts: 1, hintsUsed: 1, learningStage: "connect" }),
      runOriOverride: async () => response,
    });
    const ticket = await workflow.propose("student", "project-a");
    expect(ticket?.status).toBe("pending");
    semanticHash = "c".repeat(64);
    expect((await workflow.decide("student", "project-a", ticket!.id, "accept"))?.status).toBe(
      "stale",
    );
  });
  it("refuses decisions after project ownership is revoked", async () => {
    let ownerId = "student";
    const repository = { get: async () => ({ ...base, ownerId }) } as unknown as ProjectRepository;
    const workflow = createOriCanonicalReviewWorkflow({
      repository,
      oriRoot: "/unused-with-test-override",
      world: {},
      learningContext: async () => ({ attempts: 1, hintsUsed: 1, learningStage: "connect" }),
      runOriOverride: async () => response,
    });
    const ticket = await workflow.propose("student", "project-a");
    expect(ticket?.status).toBe("pending");
    ownerId = "other";
    expect(await workflow.decide("student", "project-a", ticket!.id, "accept")).toBeNull();
    expect(await workflow.read("student", "project-a", ticket!.id)).toBeNull();
  });
});
