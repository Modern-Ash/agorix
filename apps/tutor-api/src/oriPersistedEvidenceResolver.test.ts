import { describe, expect, it } from "vitest";
import type { ProjectRepository } from "@agorix/project-repository";
import type { RunResult } from "@agorix/runtime";
import { createOriPersistedEvidenceResolver } from "./oriPersistedEvidenceResolver.js";
const hash = "a".repeat(64);
const program = { scripts: [] };
const record = {
  ownerId: "student",
  projectId: "project-a",
  semanticHash: hash,
  revision: 1,
  storedProject: { program },
};
const result = {
  outcome: "completed",
  stepsUsed: 1,
  trace: [
    {
      step: 1,
      statementType: "move",
      nodeId: "secret",
      worldBefore: { x: 0 },
      worldAfter: { x: 1 },
    },
  ],
} as unknown as RunResult;
const context = async () => ({ attempts: 1, hintsUsed: 1, learningStage: "connect" as const });
describe("Ori persisted canonical execution evidence", () => {
  it("exports bounded evidence without raw program or world", async () => {
    const resolve = createOriPersistedEvidenceResolver({
      repository: { get: async () => record } as unknown as ProjectRepository,
      execute: async () => ({ result }),
      learningContext: context,
    });
    const value = await resolve("student", "project-a");
    expect(value?.revision).toBe(hash);
    expect(value?.evidence.trace.steps).toEqual([{ index: 0, description: "Executed move" }]);
    expect(JSON.stringify(value)).not.toContain("secret");
    expect(JSON.stringify(value)).not.toContain("worldBefore");
  });
  it("rejects changed project after asynchronous execution", async () => {
    let reads = 0;
    const resolve = createOriPersistedEvidenceResolver({
      repository: {
        get: async () => ({ ...record, revision: ++reads }),
      } as unknown as ProjectRepository,
      execute: async () => ({ result }),
      learningContext: context,
    });
    expect(await resolve("student", "project-a")).toBeNull();
  });
  it("fails closed on unauthorized owner and noncompleted runs", async () => {
    const repository = {
      get: async (owner: string) => {
        if (owner !== "student") throw Error("denied");
        return record;
      },
    } as unknown as ProjectRepository;
    const resolve = createOriPersistedEvidenceResolver({
      repository,
      execute: async () => ({ result: { ...result, outcome: "stopped" } }),
      learningContext: context,
    });
    expect(await resolve("intruder", "project-a")).toBeNull();
    expect(await resolve("student", "project-a")).toBeNull();
  });
});
