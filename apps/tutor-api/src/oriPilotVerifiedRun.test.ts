import { describe, expect, it } from "vitest";
import type { ProjectRepository } from "@agorix/project-repository";
import { createOriPilotVerifiedRun } from "./oriPilotVerifiedRun.js";
import { createOriSessionLearningJournal } from "./oriSessionLearningJournal.js";

const project = {
  ownerId: "owner",
  projectId: "project",
  revision: 1,
  semanticHash: "fnv1a32:1234abcd",
  storedProject: {
    schemaVersion: "agorix/program/v1",
    program: {
      schema: "agorix/program/v1",
      scripts: [
        {
          id: "main",
          trigger: { type: "greenFlag" },
          statements: [{ type: "move", steps: 1 }],
        },
      ],
    },
    metadata: {
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      missionProgress: 0,
      hintLevel: 0,
      missionSpec: { goal: "kids.cell.4.2", successCheck: "touches-goal" },
    },
  },
};

describe("Ori server-verified pilot run", () => {
  it("records only a current owner-scoped canonical run in session memory", async () => {
    const journal = createOriSessionLearningJournal();
    const repository = {
      get: async (owner: string, projectId: string) => {
        if (owner !== "owner" || projectId !== "project") throw new Error("denied");
        return project;
      },
    } as unknown as ProjectRepository;
    const run = createOriPilotVerifiedRun({ repository, journal });
    expect(await run("other", "project", "session")).toBe(false);
    expect(await run("owner", "project", "session")).toBe(true);
    expect(journal.learningContext("owner", "project", "session", project.semanticHash)).toEqual({
      attempts: 1,
      hintsUsed: 0,
      learningStage: "explore",
    });
  });

  it("rejects a project revision changed during server execution", async () => {
    let reads = 0;
    const journal = createOriSessionLearningJournal();
    const repository = {
      get: async () => ({ ...project, revision: ++reads }),
    } as unknown as ProjectRepository;
    const run = createOriPilotVerifiedRun({ repository, journal });
    expect(await run("owner", "project", "session")).toBe(false);
    expect(journal.learningContext("owner", "project", "session", project.semanticHash)).toBeNull();
  });
});
