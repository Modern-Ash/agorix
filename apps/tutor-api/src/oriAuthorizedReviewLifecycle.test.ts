import { describe, expect, it } from "vitest";
import type { ProjectRepository } from "@agorix/project-repository";
import { SCHEMA_VERSION } from "@agorix/program-model";
import { createOriAuthorizedReviewOptions } from "./oriAuthorizedReviewComposition.js";

const revision = "a".repeat(64);
const project = {
  ownerId: "learner",
  projectId: "project-1",
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
const ready = {
  status: "ready" as const,
  requiresLearnerApproval: true as const,
  appliedChanges: false as const,
  proposal: {
    schemaVersion: "ori/proposal/v0",
    operation: "append",
    requiresLearnerApproval: true,
    blocks: [{ kind: "move", steps: 1 }],
  },
  evidenceReceipt: { programRevision: revision, digest: "b".repeat(64), complete: true as const },
};
describe("authorized canonical Ori review lifecycle", () => {
  it("executes the persisted project and records learner rejection without writes", async () => {
    let runs = 0;
    let writes = 0;
    const options = createOriAuthorizedReviewOptions({
      repository: {
        get: async () => project,
        update: async () => {
          writes++;
          throw Error("write forbidden");
        },
      } as unknown as ProjectRepository,
      oriRoot: "/test-only",
      world: { goal: { x: 10, y: 0 } },
      learningContext: async () => ({ attempts: 1, hintsUsed: 1, learningStage: "connect" }),
      resolveSession: async () => ({ accountId: "learner", sessionId: "session-1" }),
      activeProject: async () => "project-1",
      runOriOverride: async (evidence) => {
        runs++;
        expect(evidence).toMatchObject({ programRevision: revision, expectedSteps: 1 });
        return ready;
      },
    });
    const identity = await options.oriReviewIdentity({} as never);
    expect(identity).toEqual({ ownerId: "learner", projectId: "project-1" });
    const ticket = await options.oriReviewPropose(identity!.ownerId, identity!.projectId);
    expect(ticket?.status).toBe("pending");
    const decision = await options.oriReviewDecision("learner", "project-1", ticket!.id, "reject");
    expect(decision?.status).toBe("rejected");
    expect(runs).toBe(1);
    expect(writes).toBe(0);
  });
  it("refuses proposal issuance when verified learning context is unavailable", async () => {
    let runs = 0;
    const options = createOriAuthorizedReviewOptions({
      repository: { get: async () => project } as unknown as ProjectRepository,
      oriRoot: "/test-only",
      world: {},
      learningContext: async () => null,
      resolveSession: async () => ({ accountId: "learner", sessionId: "session-1" }),
      activeProject: async () => "project-1",
      runOriOverride: async () => {
        runs++;
        return ready;
      },
    });
    expect(await options.oriReviewPropose("learner", "project-1")).toBeNull();
    expect(runs).toBe(0);
  });
});
