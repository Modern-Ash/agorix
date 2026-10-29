import { describe, expect, it } from "vitest";
import type { ProjectRepository } from "@agorix/project-repository";
import { createOriAuthorizedReviewOptions } from "./oriAuthorizedReviewComposition.js";
import { openOriTicketPresentationSqliteStore } from "./oriTicketPresentationSqliteStore.js";

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
      sessionId: "session-1",
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
  it("keeps presentation disabled without a durable store", () => {
    const options = createOriAuthorizedReviewOptions({
      repository: {
        get: async () => {
          throw Error("missing");
        },
      } as unknown as ProjectRepository,
      oriRoot: "/test-only",
      world: {},
      learningContext: async () => null,
      resolveSession: async () => null,
      activeProject: async () => null,
      runOriOverride: async () => ({
        status: "unavailable",
        appliedChanges: false,
        requiresLearnerApproval: true,
      }),
    });
    expect("oriPresentationAckEnabled" in options).toBe(false);
    expect("oriReviewApplyEnabled" in options).toBe(false);
  });
  it("exposes apply only when the trusted atomic PostgreSQL commit is injected", () => {
    const options = createOriAuthorizedReviewOptions({
      repository: {
        get: async () => {
          throw Error("missing");
        },
      } as unknown as ProjectRepository,
      oriRoot: "/test-only",
      world: {},
      learningContext: async () => null,
      resolveSession: async () => null,
      activeProject: async () => null,
      oriMig04AtomicCommit: async () => "denied",
      runOriOverride: async () => ({
        status: "unavailable",
        appliedChanges: false,
        requiresLearnerApproval: true,
      }),
    });
    expect(options.oriReviewApplyEnabled).toBe(true);
    expect(typeof options.oriReviewApply).toBe("function");
  });
  it("wires a durable store to the authenticated canonical workflow only when injected", async () => {
    const store = openOriTicketPresentationSqliteStore(":memory:");
    try {
      const options = createOriAuthorizedReviewOptions({
        repository: {
          get: async () => {
            throw Error("missing");
          },
        } as unknown as ProjectRepository,
        oriRoot: "/test-only",
        world: {},
        learningContext: async () => null,
        resolveSession: async () => null,
        activeProject: async () => null,
        presentationStore: store,
        runOriOverride: async () => ({
          status: "unavailable",
          appliedChanges: false,
          requiresLearnerApproval: true,
        }),
      });
      expect(options.oriPresentationAckEnabled).toBe(true);
      expect(typeof options.oriPresentationAckHandler).toBe("function");
    } finally {
      store.close();
    }
  });
});
