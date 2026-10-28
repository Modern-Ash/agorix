import { describe, expect, it } from "vitest";
import { configFromEnv } from "./index.js";
import { startOriMig04PgSharedAuthProductionHost } from "./oriMig04PgSharedAuthProductionHost.js";

const options = {
  env: {},
  connectionString: "postgresql://127.0.0.1:1/ori?connect_timeout=1",
  tutor: { config: configFromEnv({}) },
  ori: {
    deploymentId: "ori",
    oriRoot: "/trusted/ori",
    world: {},
    learningContext: async () => null,
    rolloutDecide: () => ({ learnerVisible: false }),
    runOriOverride: async () => ({ status: "rejected" }) as never,
  },
};

describe("MIG-04 shared AuthService production composition", () => {
  it("denies environment-only pilot activation before opening pools", async () => {
    await expect(
      startOriMig04PgSharedAuthProductionHost({
        ...options,
        env: { AGORIX_ORI_MIG04_PILOT: "1" },
      }),
    ).rejects.toThrow("environment activation is forbidden");
  });

  it("rejects relative socket paths and empty database URL", async () => {
    await expect(
      startOriMig04PgSharedAuthProductionHost({ ...options, socket: "relative/ori.sock" }),
    ).rejects.toThrow("Invalid Ori Unix socket path");
    await expect(
      startOriMig04PgSharedAuthProductionHost({ ...options, connectionString: "" }),
    ).rejects.toThrow("durable PostgreSQL");
  });

  it("closes shared AuthService pool when integrated startup fails", async () => {
    await expect(startOriMig04PgSharedAuthProductionHost(options)).rejects.toThrow();
  });
});
