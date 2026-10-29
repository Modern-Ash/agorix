import { describe, expect, it } from "vitest";
import type { ProjectRepository } from "@agorix/project-repository";
import { openOriSqliteProjectSelection } from "./oriSqliteProjectSelection.js";

const owner = "learner";
const session = { accountId: owner, sessionId: "session-a" };
describe("SQLite active-project composition", () => {
  it("selects, rotates and clears a persisted project", async () => {
    const selection = openOriSqliteProjectSelection({
      path: ":memory:",
      repository: {
        get: async (account: string, id: string) => {
          if (account !== owner || id !== "project-a") throw Error("not found");
          return { ownerId: owner, projectId: id };
        },
      } as unknown as Pick<ProjectRepository, "get">,
    });
    try {
      expect(await selection.choose(session, "project-a")).toBe(true);
      expect(await selection.activeProject(session)).toBe("project-a");
      const next = { ...session, sessionId: "session-b" };
      expect(await selection.rotated(session, next)).toBe(true);
      expect(await selection.activeProject(session)).toBeNull();
      expect(await selection.activeProject(next)).toBe("project-a");
      await selection.signedOut(next);
      expect(await selection.activeProject(next)).toBeNull();
    } finally {
      selection.close();
    }
  });
  it("denies unauthorized projects and ambiguous identity", async () => {
    const selection = openOriSqliteProjectSelection({
      path: ":memory:",
      repository: {
        get: async () => {
          throw Error("not found");
        },
      } as unknown as Pick<ProjectRepository, "get">,
    });
    try {
      expect(await selection.choose(session, "foreign")).toBe(false);
      expect(await selection.activeProject(session)).toBeNull();
    } finally {
      selection.close();
    }
  });
});
