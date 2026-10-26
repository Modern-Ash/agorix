import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import { InMemoryProjectRepository } from "@agorix/project-repository";
import { applyApprovedOriProposal } from "./oriApprovedProjectApply.js";

const program: ProjectProgram = {
  schema: SCHEMA_VERSION,
  scripts: [
    { id: "main", trigger: { type: "onStart" }, statements: [{ type: "move", steps: 1 }] },
  ],
};
const proposal = {
  schemaVersion: "ori/proposal/v0",
  operation: "append",
  requiresLearnerApproval: true,
  blocks: [{ kind: "move", steps: 2 }],
};

describe("Ori approved mutation CAS adversarial cases", () => {
  it("permits only one of two concurrent updates for the same revision", async () => {
    const repository = new InMemoryProjectRepository({ idFactory: () => "p1" });
    const record = await repository.create("student", "Demo", {
      schemaVersion: SCHEMA_VERSION,
      program,
      metadata: {
        createdAt: "2026-10-26T00:00:00.000Z",
        updatedAt: "2026-10-26T00:00:00.000Z",
        missionProgress: 0,
        hintLevel: 1,
      },
    });
    const apply = () =>
      applyApprovedOriProposal({
        repository,
        owner: "student",
        projectId: record.projectId,
        expectedRevision: record.revision,
        approved: true,
        proposal,
        allowedBlocks: ["move"],
        scriptId: "main",
      });
    const results = await Promise.all([apply(), apply()]);
    expect(results.sort()).toEqual(["applied", "conflict"]);
    const current = await repository.get("student", record.projectId);
    expect(current.revision).toBe(record.revision + 1);
    expect(current.storedProject.program.scripts[0]?.statements).toHaveLength(2);
  });
});
