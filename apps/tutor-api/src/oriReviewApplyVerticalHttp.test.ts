import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { SCHEMA_VERSION } from "@agorix/program-model";
import { InMemoryProjectRepository } from "@agorix/project-repository";
import { createTutorServer } from "./server.js";
import { configFromEnv } from "./index.js";
import { createOriCanonicalReviewWorkflow } from "./oriCanonicalReviewWorkflow.js";
import { oriEvidenceRevision } from "./oriPersistedEvidenceResolver.js";

const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) =>
    new Promise<void>((resolve) => server.close(() => resolve()))));
});

describe("Ori persisted project -> accepted ticket -> HTTP apply", () => {
  it("persists only after learner review, then rejects a duplicate application", async () => {
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
    const workflow = createOriCanonicalReviewWorkflow({
      repository,
      oriRoot: "/unused-test-override",
      world: { goal: { x: 10, y: 0 } },
      learningContext: async () => ({ attempts: 1, hintsUsed: 1, learningStage: "connect" }),
      runOriOverride: async () => ({
        status: "ready",
        proposal: {
          schemaVersion: "ori/proposal/v0",
          operation: "append",
          requiresLearnerApproval: true,
          blocks: [{ kind: "move", steps: 2 }],
        },
        evidenceReceipt: {
          programRevision: oriEvidenceRevision(record.semanticHash, record.revision),
          digest: "b".repeat(64),
          complete: true,
        },
        requiresLearnerApproval: true,
        appliedChanges: false,
      }),
    });
    const server = createTutorServer({
      config: configFromEnv({ AGORIX_TUTOR_ADAPTER: "fake" }),
      oriReviewEnabled: true,
      oriReviewApplyEnabled: true,
      oriReviewIdentity: async () => ({ ownerId: "student", projectId: record.projectId }),
      oriReviewPropose: workflow.propose,
      oriReviewDecision: workflow.decide,
      oriReviewApply: workflow.applyAccepted,
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const post = (path: string, body: unknown) => fetch(base + path, {
      method: "POST",
      headers: { origin: base, "content-type": "application/json", "x-agorix-request": "1" },
      body: JSON.stringify(body),
    });
    const proposed = await post("/api/tutor/ori/review/propose", {});
    expect(proposed.status).toBe(200);
    const issued = await proposed.json() as { ticketId: string };
    const applyBody = { ticketId: issued.ticketId, scriptId: "main" };
    expect((await post("/api/tutor/ori/review/apply", applyBody)).status).toBe(403);
    expect((await repository.get("student", record.projectId)).revision).toBe(1);
    const decision = await post("/api/tutor/ori/review/decision", {
      ticketId: issued.ticketId,
      decision: "accept",
    });
    expect(decision.status).toBe(200);
    expect((await post("/api/tutor/ori/review/apply", applyBody)).status).toBe(200);
    expect((await post("/api/tutor/ori/review/apply", applyBody)).status).toBe(403);
    const updated = await repository.get("student", record.projectId);
    expect(updated.revision).toBe(2);
    expect(updated.storedProject.program.scripts[0]?.statements).toHaveLength(2);
  });
});
