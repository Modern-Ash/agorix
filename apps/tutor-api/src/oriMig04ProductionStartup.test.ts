import { describe, expect, it } from "vitest";
import { configFromEnv } from "./index.js";
import { startOriMig04ProductionStartup } from "./oriMig04ProductionStartup.js";

const options = {
  env: {},
  connectionString: "postgresql://127.0.0.1:1/ori",
  tutor: { config: configFromEnv({}) },
  ori: {
    deploymentId: "ori",
    auth: {
      resolveSession: async () => {
        throw Error("unused");
      },
    },
    oriRoot: "/trusted/ori",
    world: {},
    learningContext: async () => null,
    rolloutDecide: () => ({ learnerVisible: false }),
  },
} as const;

describe("MIG-04 production process startup", () => {
  it("rejects environment-only pilot activation", async () => {
    await expect(
      startOriMig04ProductionStartup({
        ...options,
        env: { AGORIX_ORI_MIG04_PILOT: "1" },
      }),
    ).rejects.toThrow("environment activation is forbidden");
  });

  it("rejects Unix socket startup rather than silently changing transport", async () => {
    await expect(
      startOriMig04ProductionStartup({ ...options, socket: "/tmp/ori.sock" }),
    ).rejects.toThrow("does not support Unix socket");
  });

  it("requires durable PostgreSQL and trusted authentication", async () => {
    await expect(
      startOriMig04ProductionStartup({ ...options, connectionString: "" }),
    ).rejects.toThrow("durable PostgreSQL");
    await expect(
      startOriMig04ProductionStartup({ ...options, ori: {} as never }),
    ).rejects.toThrow("shared trusted AuthService");
  });

  it("does not open an HTTP listener if PostgreSQL is unavailable", async () => {
    await expect(startOriMig04ProductionStartup(options)).rejects.toThrow();
  });
});
