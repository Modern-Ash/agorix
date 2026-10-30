import { describe, expect, it } from "vitest";
import type { ProjectRepository } from "@agorix/project-repository";
import { createOriPilotHintIssuer } from "./oriPilotHintIssuer.js";
import { createOriSessionLearningJournal } from "./oriSessionLearningJournal.js";

const project = {
  ownerId: "owner",
  projectId: "project",
  revision: 1,
  semanticHash: "fnv1a32:1234abcd",
  storedProject: {
    schemaVersion: "agorix/program/v1",
    program: { schema: "agorix/program/v1", scripts: [] },
    metadata: {
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      missionProgress: 0,
      hintLevel: 0,
      missionSpec: { goal: "kids.cell.4.2", successCheck: "touches-goal" },
    },
  },
};

describe("Ori server-issued pilot hint", () => {
  it("issues sequential hints only after a verified session run", async () => {
    const journal = createOriSessionLearningJournal();
    const repository = { get: async () => project } as unknown as ProjectRepository;
    const issue = createOriPilotHintIssuer({ repository, journal });
    expect(await issue("owner", "project", "session")).toBeNull();
    expect(
      journal.recordVerifiedRun(
        "owner",
        "project",
        "session",
        project.semanticHash,
        "explore",
        "a".repeat(64),
      ),
    ).toBe(true);
    expect((await issue("owner", "project", "session"))?.level).toBe(1);
    expect((await issue("owner", "project", "session"))?.level).toBe(2);
    expect(
      journal.learningContext("owner", "project", "session", project.semanticHash)?.hintsUsed,
    ).toBe(2);
    expect(await issue("other", "project", "session")).toBeNull();
  });

  it("rejects a revision changed before hint issuance", async () => {
    const journal = createOriSessionLearningJournal();
    journal.recordVerifiedRun(
      "owner",
      "project",
      "session",
      project.semanticHash,
      "explore",
      "a".repeat(64),
    );
    let reads = 0;
    const repository = {
      get: async () => ({ ...project, revision: ++reads }),
    } as unknown as ProjectRepository;
    expect(
      await createOriPilotHintIssuer({ repository, journal })("owner", "project", "session"),
    ).toBeNull();
    expect(
      journal.learningContext("owner", "project", "session", project.semanticHash)?.hintsUsed,
    ).toBe(0);
  });

  it("continues after the persisted Kids hint level without repeating a hint", async () => {
    const journal = createOriSessionLearningJournal();
    const saved = {
      ...project,
      storedProject: {
        ...project.storedProject,
        metadata: { ...project.storedProject.metadata, hintLevel: 1 },
      },
    };
    const repository = { get: async () => saved } as unknown as ProjectRepository;
    journal.recordVerifiedRun(
      "owner",
      "project",
      "session",
      saved.semanticHash,
      "explore",
      "a".repeat(64),
    );
    const issue = createOriPilotHintIssuer({ repository, journal });
    expect(await issue("owner", "project", "session", 3)).toBeNull();
    expect(
      journal.learningContext("owner", "project", "session", saved.semanticHash)?.hintsUsed,
    ).toBe(0);
    expect((await issue("owner", "project", "session", 2))?.level).toBe(2);
    expect(
      journal.learningContext("owner", "project", "session", saved.semanticHash)?.hintsUsed,
    ).toBe(2);
    expect((await issue("owner", "project", "session"))?.level).toBe(3);
  });
});
