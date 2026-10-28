import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import { POSTGRESQL_SCHEMA_SQL } from "@agorix/project-repository";
import { createOriMig04PgCanonicalInfrastructure } from "./oriMig04PgCanonicalInfrastructure.js";
import { createOriCanonicalReviewWorkflow } from "./oriCanonicalReviewWorkflow.js";
import type { TrustedOriEvidence } from "./oriHostEvidenceAdapter.js";

const databaseUrl = process.env["ORI_MIG04_TEST_DATABASE_URL"];
const run = databaseUrl ? describe : describe.skip;

run("MIG-04 canonical review workflow with real PostgreSQL persistence", () => {
  it("proposes, accepts and persists once, denying replay and another owner", async () => {
    if (!databaseUrl) throw Error("Missing test database URL");
    const { Pool } = await import("pg");
    const admin = new Pool({ connectionString: databaseUrl });
    const infra = createOriMig04PgCanonicalInfrastructure(databaseUrl);
    const owner = `owner_${Date.now().toString(36)}_${Math.floor(Math.random() * 100000)}`;
    const program: ProjectProgram = {
      schema: SCHEMA_VERSION,
      scripts: [{
        id: "main",
        trigger: { type: "onStart" },
        statements: [{ type: "move", steps: 1 }],
      }],
    };
    let projectId: string | undefined;
    try {
      await admin.query(POSTGRESQL_SCHEMA_SQL);
      await admin.query("alter table agorix_projects add column if not exists title text");
      await admin.query("alter table agorix_projects add column if not exists created_at text");
      const record = await infra.repository.create(owner, "Review fixture", {
        schemaVersion: SCHEMA_VERSION,
        program,
        metadata: {
          createdAt: "2026-10-28T00:00:00.000Z",
          updatedAt: "2026-10-28T00:00:00.000Z",
          missionProgress: 0,
          hintLevel: 1,
        },
      });
      projectId = record.projectId;
      const workflow = createOriCanonicalReviewWorkflow({
        repository: infra.repository,
        oriRoot: "/unused-with-test-override",
        world: { goal: { x: 10, y: 0 } },
        learningContext: async () => ({ attempts: 1, hintsUsed: 1, learningStage: "connect" }),
        runOriOverride: async (raw) => ({
          status: "ready",
          proposal: {
            schemaVersion: "ori/proposal/v0",
            operation: "append",
            requiresLearnerApproval: true,
            blocks: [{ kind: "move", steps: 2 }],
          },
          evidenceReceipt: {
            programRevision: (raw as TrustedOriEvidence).programRevision,
            digest: "b".repeat(64),
            complete: true,
          },
          requiresLearnerApproval: true,
          appliedChanges: false,
        }),
        mayCommit: () => true,
      });
      const ticket = await workflow.propose(owner, projectId);
      expect(ticket?.status).toBe("pending");
      if (!ticket) throw Error("Expected review ticket");
      expect(await workflow.decide("intruder", projectId, ticket.id, "accept")).toBeNull();
      expect(await workflow.applyAccepted(owner, projectId, ticket.id, "main")).toBe("rejected");
      expect((await workflow.decide(owner, projectId, ticket.id, "accept"))?.status).toBe("accepted");
      expect(await workflow.applyAccepted(owner, projectId, ticket.id, "main")).toBe("applied");
      const persisted = await infra.repository.get(owner, projectId);
      expect(persisted.revision).toBe(record.revision + 1);
      expect(persisted.storedProject.program.scripts[0]?.statements).toEqual([
        { type: "move", steps: 1 },
        { type: "move", steps: 2 },
      ]);
      expect(await workflow.applyAccepted(owner, projectId, ticket.id, "main")).toBe("rejected");
      await expect(infra.repository.get("intruder", projectId)).rejects.toThrow();
    } finally {
      if (projectId) {
        await admin.query("delete from agorix_projects where owner_id = $1 and project_id = $2", [
          owner, projectId,
        ]);
      }
      await infra.close();
      await admin.end();
    }
  });
});
