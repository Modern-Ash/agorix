import { describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ProjectRepository } from "@agorix/project-repository";
import { configFromEnv } from "./index.js";
import { createOriMig04PgTutorServer } from "./oriMig04PgTutorServer.js";

describe("MIG-04 trusted TutorServer bootstrap", () => {
  it("constructs an HTTP server without connecting or enabling a rollout", async () => {
    let connections = 0;
    const { server } = createOriMig04PgTutorServer({
      tutor: { config: configFromEnv({}) },
      ori: {
        pool: {
          connect: async () => {
            connections++;
            throw Error("unexpected connection");
          },
        },
        deploymentId: "ori",
        repository: {} as ProjectRepository,
        oriRoot: mkdtempSync(join(tmpdir(), "ori-server-")),
        world: {},
        learningContext: async () => null,
        resolveSession: async () => null,
        activeProject: async () => null,
        rolloutDecide: () => ({ learnerVisible: false }),
      },
    });
    expect(server.listening).toBe(false);
    expect(connections).toBe(0);
    server.close();
  });
  it("refuses to create a server without trusted authentication", () => {
    expect(() =>
      createOriMig04PgTutorServer({
        tutor: { config: configFromEnv({}) },
        ori: {
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
          resolveSession: undefined as never,
          activeProject: async () => null,
          rolloutDecide: () => ({ learnerVisible: false }),
        },
      }),
    ).toThrow("Missing trusted Ori host dependencies");
  });
});
