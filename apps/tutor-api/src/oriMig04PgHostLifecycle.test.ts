import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ProjectRepository } from "@agorix/project-repository";
import { configFromEnv } from "./index.js";
import { startOriMig04PgHost } from "./oriMig04PgHostLifecycle.js";

describe("MIG-04 trusted PostgreSQL host lifecycle", () => {
  it("starts a loopback server with denied rollout and closes cleanly", async () => {
    const oriRoot = mkdtempSync(join(tmpdir(), "ori-host-runtime-"));
    let connections = 0;
    try {
      const host = await startOriMig04PgHost({
        tutor: { config: configFromEnv({}) },
        ori: {
          pool: {
            connect: async () => {
              connections++;
              throw Error("database must not be accessed during startup");
            },
          },
          deploymentId: "ori",
          repository: {} as ProjectRepository,
          oriRoot,
          world: {},
          learningContext: async () => null,
          resolveSession: async () => null,
          activeProject: async () => null,
          rolloutDecide: () => ({ learnerVisible: false }),
          runOriOverride: async () => ({ status: "rejected" }) as never,
        },
      });
      try {
        expect(host.address.address).toBe("127.0.0.1");
        expect(host.address.port).toBeGreaterThan(0);
        expect(connections).toBe(0);
      } finally {
        await host.close();
        await host.close();
      }
    } finally {
      rmSync(oriRoot, { recursive: true, force: true });
    }
  });
  it("rejects invalid port before creating a server", async () => {
    await expect(
      startOriMig04PgHost({
        tutor: { config: configFromEnv({}) },
        ori: {} as never,
        port: -1,
      }),
    ).rejects.toThrow("Invalid Ori host port");
  });
});
