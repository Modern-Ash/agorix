import { describe, expect, it } from "vitest";
import type { ProjectRepository } from "@agorix/project-repository";
import { createOriAuthorizedReviewOptions } from "./oriAuthorizedReviewComposition.js";

describe("Ori authorized review composition", () => {
  it("rejects a guest before selecting a project", async () => {
    let projectLookups = 0;
    const options = createOriAuthorizedReviewOptions({
      repository: { get: async () => { projectLookups++; throw Error("denied"); } } as unknown as ProjectRepository,
      oriRoot: "/test-only",
      world: {},
      learningContext: async () => null,
      resolveSession: async () => null,
      activeProject: async () => "project-1",
      runOriOverride: async () => ({status:"unavailable",appliedChanges:false,requiresLearnerApproval:true})
    });
    expect(await options.oriReviewIdentity({} as never)).toBeNull();
    expect(projectLookups).toBe(0);
  });
});
