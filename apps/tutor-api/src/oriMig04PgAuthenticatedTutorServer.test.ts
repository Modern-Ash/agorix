import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ProjectRepository } from "@agorix/project-repository";
import { configFromEnv } from "./index.js";
import { createOriMig04PgAuthenticatedTutorServer } from "./oriMig04PgAuthenticatedTutorServer.js";

describe("MIG-04 AuthService-backed TutorServer", () => {
  it("builds an authenticated HTTP server without opening PostgreSQL", () => {
    const oriRoot = mkdtempSync(join(tmpdir(), "ori-auth-server-"));
    let connections = 0;
    try {
      const { server } = createOriMig04PgAuthenticatedTutorServer({
        tutor: { config: configFromEnv({}) },
        ori: {
          auth: {
            resolveSession: async () => {
              throw Error("not called during construction");
            },
          },
          sessionToken: () => null,
          pool: {
            connect: async () => {
              connections++;
              throw Error("unexpected connection");
            },
          },
          deploymentId: "ori",
          repository: {} as ProjectRepository,
          oriRoot,
          world: {},
          learningContext: async () => null,
          activeProject: async () => null,
          rolloutDecide: () => ({ learnerVisible: false }),
          runOriOverride: async () => ({ status: "rejected" }) as never,
        },
      });
      expect(server.listening).toBe(false);
      expect(connections).toBe(0);
      server.close();
    } finally {
      rmSync(oriRoot, { recursive: true, force: true });
    }
  });
  it("rejects absent AuthService dependencies before opening PostgreSQL", () => {
    expect(() =>
      createOriMig04PgAuthenticatedTutorServer({
        tutor: { config: configFromEnv({}) },
        ori: {
          auth: undefined as never,
          sessionToken: () => null,
          pool: {
            connect: async () => {
              throw Error("unexpected connection");
            },
          },
          deploymentId: "ori",
          repository: {} as ProjectRepository,
          oriRoot: "/unused",
          world: {},
          learningContext: async () => null,
          activeProject: async () => null,
          rolloutDecide: () => ({ learnerVisible: false }),
        },
      }),
    ).toThrow("Missing trusted Ori authentication dependencies");
  });
});
