import { describe, expect, it } from "vitest";
import type { ProjectRepository } from "@agorix/project-repository";
import { createOriAuthorizedReviewOptions } from "./oriAuthorizedReviewComposition.js";

describe("Ori authorized review composition", () => {
  it("authorizes only the active project owned by the session", async () => {
    const options = createOriAuthorizedReviewOptions({
      repository: {
        get: async () => ({ ownerId: "learner", projectId: "project-1" }),
      } as unknown as ProjectRepository,
      oriRoot: "/test-only",
      world: {},
      learningContext: async () => null,
      resolveSession: async () => ({ accountId: "learner", sessionId: "session-1" }),
      activeProject: async () => "project-1",
      runOriOverride: async () => ({
        status: "unavailable",
        appliedChanges: false,
        requiresLearnerApproval: true,
      }),
    });
    expect(await options.oriReviewIdentity({} as never)).toEqual({
      ownerId: "learner",
      projectId: "project-1",
    });
  });
  it("rejects a guest before selecting a project", async () => {
    let projectLookups = 0;
    const options = createOriAuthorizedReviewOptions({
      repository: {
        get: async () => {
          projectLookups++;
          throw Error("denied");
        },
      } as unknown as ProjectRepository,
      oriRoot: "/test-only",
      world: {},
      learningContext: async () => null,
      resolveSession: async () => null,
      activeProject: async () => "project-1",
      runOriOverride: async () => ({
        status: "unavailable",
        appliedChanges: false,
        requiresLearnerApproval: true,
      }),
    });
    expect(await options.oriReviewIdentity({} as never)).toBeNull();
    expect(projectLookups).toBe(0);
  });
});
