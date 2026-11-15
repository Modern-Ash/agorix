import { describe, expect, it } from "vitest";
import type { ProjectRepository } from "@agorix/project-repository";
import { createOriMig04PgBootstrap } from "./oriMig04PgBootstrapContract.js";

describe("MIG-04 trusted bootstrap", () => {
  it("rejects invalid deployment IDs before connecting", () => {
    let connections = 0;
    expect(() =>
      createOriMig04PgBootstrap({
        pool: {
          connect: async () => {
            connections++;
            throw Error("unexpected");
          },
        },
        deploymentId: "invalid deployment",
        repository: {} as ProjectRepository,
        oriRoot: "/unused",
        world: {},
        learningContext: async () => null,
        resolveSession: async () => null,
        activeProject: async () => null,
        rolloutDecide: () => ({ learnerVisible: false }),
      }),
    ).toThrow("Invalid Ori deployment identifier");
    expect(connections).toBe(0);
  });
  it("rejects absent rollout policy before opening a database connection", () => {
    let connections = 0;
    expect(() =>
      createOriMig04PgBootstrap({
        pool: {
          connect: async () => {
            connections++;
            throw Error("unexpected");
          },
        },
        deploymentId: "ori",
        repository: {} as ProjectRepository,
        oriRoot: "/unused",
        world: {},
        learningContext: async () => null,
        resolveSession: async () => null,
        activeProject: async () => null,
        rolloutDecide: undefined as never,
      }),
    ).toThrow("Missing trusted Ori host dependencies");
    expect(connections).toBe(0);
  });
  it("rejects absent authenticated session resolver before opening PostgreSQL", () => {
    let connections = 0;
    expect(() =>
      createOriMig04PgBootstrap({
        pool: {
          connect: async () => {
            connections++;
            throw Error("unexpected");
          },
        },
        deploymentId: "ori",
        repository: {} as ProjectRepository,
        oriRoot: "/unused",
        world: {},
        learningContext: async () => null,
        resolveSession: undefined as never,
        activeProject: async () => null,
        rolloutDecide: () => ({ learnerVisible: false }),
      }),
    ).toThrow("Missing trusted Ori host dependencies");
    expect(connections).toBe(0);
  });
  it("rejects absent active-project selector before connecting", () => {
    let connections = 0;
    expect(() =>
      createOriMig04PgBootstrap({
        pool: {
          connect: async () => {
            connections++;
            throw Error("unexpected");
          },
        },
        deploymentId: "ori",
        repository: {} as ProjectRepository,
        oriRoot: "/unused",
        world: {},
        learningContext: async () => null,
        resolveSession: async () => null,
        activeProject: undefined as never,
        rolloutDecide: () => ({ learnerVisible: false }),
      }),
    ).toThrow("Missing trusted Ori host dependencies");
    expect(connections).toBe(0);
  });
  it("rejects absent canonical project repository before connecting", () => {
    let connections = 0;
    expect(() =>
      createOriMig04PgBootstrap({
        pool: {
          connect: async () => {
            connections++;
            throw Error("unexpected");
          },
        },
        deploymentId: "ori",
        repository: undefined as never,
        oriRoot: "/unused",
        world: {},
        learningContext: async () => null,
        resolveSession: async () => null,
        activeProject: async () => null,
        rolloutDecide: () => ({ learnerVisible: false }),
      }),
    ).toThrow("Missing trusted Ori host dependencies");
    expect(connections).toBe(0);
  });
});
