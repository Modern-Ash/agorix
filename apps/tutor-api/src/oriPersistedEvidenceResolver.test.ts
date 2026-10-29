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
  it("uses a server-derived project world and refuses an unresolved world", async () => {
    let usedWorld: unknown;
    const resolve = createOriPersistedEvidenceResolver({
      repository: { get: async () => record } as unknown as ProjectRepository,
      execute: async (_program, world) => {
        usedWorld = world;
        return { result };
      },
      worldForProject: () => ({ goal: { x: 40, y: 20 } }),
      learningContext: context,
    });
    expect(await resolve("student", "project-a")).not.toBeNull();
    expect(usedWorld).toEqual({ goal: { x: 40, y: 20 } });
    const denied = createOriPersistedEvidenceResolver({
      repository: { get: async () => record } as unknown as ProjectRepository,
      execute: async () => {
        throw new Error("must not run");
      },
      worldForProject: () => null,
      learningContext: context,
    });
    expect(await denied("student", "project-a")).toBeNull();
  });
  it("reads learning evidence for the authenticated session and exact project hash", async () => {
    const requested: unknown[] = [];
    const resolve = createOriPersistedEvidenceResolver({
      repository: { get: async () => record } as unknown as ProjectRepository,
      execute: async () => ({ result }),
      learningContext: async (...args) => {
        requested.push(args);
        return { attempts: 1, hintsUsed: 0, learningStage: "explore" };
      },
    });
    expect(await resolve("student", "project-a", "move", "session-a")).not.toBeNull();
    expect(requested).toEqual([["student", "project-a", "session-a", hash]]);
  });
});
