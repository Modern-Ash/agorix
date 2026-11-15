import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import { InMemoryProjectRepository } from "@agorix/project-repository";
import { applyApprovedOriProposal } from "./oriApprovedProjectApply.js";
import { createOriMig04CommitFence } from "./oriMig04CommitFence.js";

const oriMove = {
  schemaVersion: "ori/proposal/v0",
  operation: "append",
  requiresLearnerApproval: true,
  blocks: [{ kind: "move", steps: 2 }],
};
const program: ProjectProgram = {
  schema: SCHEMA_VERSION,
  scripts: [
    {
      id: "main",
      trigger: { type: "onStart" as const },
      statements: [{ type: "move" as const, steps: 1 }],
    },
  ],
};
async function setup() {
  const repository = new InMemoryProjectRepository({ idFactory: () => "project-1" });
  const record = await repository.create("student", "Example", {
    schemaVersion: SCHEMA_VERSION,
    program,
    metadata: {
      createdAt: "2026-10-26T00:00:00.000Z",
      updatedAt: "2026-10-26T00:00:00.000Z",
      missionProgress: 0,
      hintLevel: 1,
    },
  });
  const apply = (overrides: Record<string, unknown> = {}) =>
    applyApprovedOriProposal({
      repository,
      owner: "student",
      projectId: record.projectId,
      expectedRevision: record.revision,
      approved: true,
      proposal: oriMove,
      allowedBlocks: ["move"],
      scriptId: "main",
      ...overrides,
    });
  return { repository, record, apply };
}
describe("explicit Ori proposal persistence boundary", () => {
  it("applies once using the repository CAS revision", async () => {
    const { repository, record, apply } = await setup();
    expect(await apply()).toBe("applied");
    const current = await repository.get("student", record.projectId);
    expect(current.revision).toBe(record.revision + 1);
    expect(current.storedProject.program.scripts[0]?.statements).toEqual([
      { type: "move", steps: 1 },
      { type: "move", steps: 2 },
    ]);
    expect(await apply()).toBe("conflict");
  });
  it("rejects commit after host policy revocation during repository read", async () => {
    const { repository, record } = await setup();
    let enabled = true;
    const guarded = {
      get: async (owner: string, projectId: string) => {
        const value = await repository.get(owner, projectId);
        enabled = false;
        return value;
      },
      update: async () => {
        throw Error("commit must not execute");
      },
    } as unknown as typeof repository;
    const result = await applyApprovedOriProposal({
      repository: guarded,
      owner: "student",
      projectId: record.projectId,
      expectedRevision: record.revision,
      approved: true,
      proposal: oriMove,
      allowedBlocks: ["move"],
      scriptId: "main",
      mayCommit: () => enabled,
    });
    expect(result).toBe("rejected");
    expect((await repository.get("student", record.projectId)).revision).toBe(record.revision);
  });
  it("refuses canonical project update when a fenced rollout generation is stale", async () => {
    const { repository, record } = await setup();
    const fence = createOriMig04CommitFence();
    expect(
      await fence.replaceFromHost({
        mode: "pilot",
        humanAuthorized: true,
        killSwitch: false,
        approvedProjectIds: [record.projectId],
      }),
    ).toBe(true);
    const generation = fence.snapshot(record.projectId).generation;
    await fence.emergencyDisable();
    expect(
      await applyApprovedOriProposal({
        repository,
        owner: "student",
        projectId: record.projectId,
        expectedRevision: record.revision,
        approved: true,
        proposal: oriMove,
        allowedBlocks: ["move"],
        scriptId: "main",
        commitFence: async (write) =>
          (await fence.commit(record.projectId, generation, write)).applied,
      }),
    ).toBe("rejected");
    expect((await repository.get("student", record.projectId)).revision).toBe(record.revision);
  });
  it("uses atomic commit outcomes without falling back to unfenced repository writes", async () => {
    const { repository, record } = await setup();
    let calls = 0;
    const guarded = {
      get: (owner: string, projectId: string) => repository.get(owner, projectId),
      update: async () => {
        throw Error("unfenced update forbidden");
      },
    } as unknown as typeof repository;
    for (const [outcome, expected] of [
      ["denied", "rejected"],
      ["conflict", "conflict"],
    ] as const) {
      expect(
        await applyApprovedOriProposal({
          repository: guarded,
          owner: "student",
          projectId: record.projectId,
          expectedRevision: record.revision,
          approved: true,
          proposal: oriMove,
          allowedBlocks: ["move"],
          scriptId: "main",
          atomicCommit: async () => {
            calls++;
            return outcome;
          },
        }),
      ).toBe(expected);
    }
    expect(calls).toBe(2);
    expect((await repository.get("student", record.projectId)).revision).toBe(record.revision);
  });
  it("does not mutate without trusted approval", async () => {
    const { repository, record, apply } = await setup();
    expect(await apply({ approved: false })).toBe("rejected");
    expect((await repository.get("student", record.projectId)).revision).toBe(1);
  });
  it("rejects wrong owner, script, and unsupported blocks", async () => {
    const { apply } = await setup();
    expect(await apply({ owner: "intruder" })).toBe("rejected");
    expect(await apply({ scriptId: "missing" })).toBe("rejected");
    expect(await apply({ allowedBlocks: [] })).toBe("rejected");
  });
  it("rejects stale revision before writing", async () => {
    const { repository, record, apply } = await setup();
    await repository.update("student", record.projectId, record.revision, { title: "Updated" });
    expect(await apply()).toBe("conflict");
  });
});
