import { describe, expect, it } from "vitest";
import type { ProjectRepository } from "@agorix/project-repository";
import { createOriMig04PgAuthorizedHostOptions } from "./oriMig04PgAuthorizedHostComposition.js";

describe("MIG-04 trusted authenticated PostgreSQL host composition", () => {
  it("keeps learner pilot invisible when rollout denies even with atomic CAS", () => {
    let connections = 0;
    const host = createOriMig04PgAuthorizedHostOptions({
      pool: {
        connect: async () => {
          connections++;
          throw Error("must not connect during composition");
        },
      },
      deploymentId: "ori",
      repository: {
        get: async () => {
          throw Error("not needed");
        },
      } as unknown as ProjectRepository,
      oriRoot: "/unused",
      world: {},
      learningContext: async () => null,
      resolveSession: async () => null,
      activeProject: async () => null,
      rolloutDecide: () => ({ learnerVisible: false }),
    });
    expect(host.options.oriMig04RolloutDecide?.("pilot").learnerVisible).toBe(false);
    expect(connections).toBe(0);
  });
  it("does not acquire a PostgreSQL connection when constructing the host", () => {
    let connections = 0;
    const host = createOriMig04PgAuthorizedHostOptions({
      pool: {
        connect: async () => {
          connections++;
          throw Error("not needed during composition");
        },
      },
      deploymentId: "ori",
      repository: {
        get: async () => {
          throw Error("not needed");
        },
      } as unknown as ProjectRepository,
      oriRoot: "/unused",
      world: {},
      learningContext: async () => null,
      resolveSession: async () => null,
      activeProject: async () => null,
      rolloutDecide: () => ({ learnerVisible: false }),
    });
    expect(host.options.oriReviewEnabled).toBe(true);
    expect(connections).toBe(0);
  });
});
