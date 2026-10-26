import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION } from "@agorix/program-model";
import { InMemoryProjectRepository } from "@agorix/project-repository";
import { createOriCanonicalReviewWorkflow } from "./oriCanonicalReviewWorkflow.js";
import type { OriHostEvidenceResult } from "./oriHostEvidenceAdapter.js";
import { createOriCanonicalExecutionPort } from "./oriCanonicalExecutionPort.js";
import { runProgram, createWorldState } from "@agorix/runtime";
import { createOriPersistedEvidenceResolver, oriEvidenceRevision } from "./oriPersistedEvidenceResolver.js";

describe("Ori accepted ticket application", () => {
  it("requires an accepted ticket and applies at most once", async () => {
    const repository = new InMemoryProjectRepository({ idFactory: () => "p1" });
    const record = await repository.create("student", "Demo", {
      schemaVersion: SCHEMA_VERSION,
      program: {
        schema: SCHEMA_VERSION,
        scripts: [
          { id: "main", trigger: { type: "onStart" }, statements: [{ type: "move", steps: 1 }] },
        ],
      },
      metadata: {
        createdAt: "2026-10-26T00:00:00.000Z",
        updatedAt: "2026-10-26T00:00:00.000Z",
        missionProgress: 0,
        hintLevel: 1,
      },
    });
    const response: OriHostEvidenceResult = {
      status: "ready",
      proposal: {
        schemaVersion: "ori/proposal/v0",
        operation: "append",
        requiresLearnerApproval: true,
        blocks: [{ kind: "move", steps: 2 }],
      },
      evidenceReceipt: {
        programRevision: oriEvidenceRevision(record.semanticHash,record.revision),
        digest: "b".repeat(64),
        complete: true,
      },
      requiresLearnerApproval: true,
      appliedChanges: false,
    };
    const workflow = createOriCanonicalReviewWorkflow({
      repository,
      oriRoot: "/unused",
      world: { goal: { x: 10, y: 0 } },
      learningContext: async () => ({ attempts: 1, hintsUsed: 1, learningStage: "connect" }),
      runOriOverride: async () => response,
    });
    const execution = runProgram(record.storedProject.program, createWorldState({ goal: { x: 10, y: 0 } }), { maxSteps: 100 });
    expect(execution.outcome).toBe("completed");
    expect(execution.stepsUsed).toBe(1);
    expect(execution.trace.map((step) => step.statementType)).toEqual(["move"]);
    const evidence = await createOriPersistedEvidenceResolver({
      repository,
      execute: createOriCanonicalExecutionPort({ world: { goal: { x: 10, y: 0 } } }),
      learningContext: async () => ({ attempts: 1, hintsUsed: 1, learningStage: "connect" }),
    })("student", record.projectId, "move");
    expect(evidence).not.toBeNull();
    const ticket = await workflow.propose("student", record.projectId);
    expect(ticket?.status).toBe("pending");
    expect(await workflow.applyAccepted("student", record.projectId, ticket!.id, "main"))
      .toBe("rejected");
    expect(await workflow.decide("student", record.projectId, ticket!.id, "accept"))
      .toMatchObject({ status: "accepted" });
    expect(await workflow.applyAccepted("intruder", record.projectId, ticket!.id, "main"))
      .toBe("rejected");
    expect(await workflow.applyAccepted("student", record.projectId, ticket!.id, "main"))
      .toBe("applied");
    expect(await workflow.applyAccepted("student", record.projectId, ticket!.id, "main"))
      .toBe("rejected");
    const updated = await repository.get("student", record.projectId);
    expect(updated.revision).toBe(record.revision + 1);
    expect(updated.storedProject.program.scripts[0]?.statements).toHaveLength(2);
  });
});
