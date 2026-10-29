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
      startOriMig04PgSharedAuthProductionHost({ ...options, socket: "/tmp/ori\u0000.sock" }),
    ).rejects.toThrow("Invalid Ori Unix socket path");
    for (const socket of ["/tmp/ori\n.sock", "/tmp/ori\r.sock"]) {
      await expect(
        startOriMig04PgSharedAuthProductionHost({ ...options, socket }),
      ).rejects.toThrow("Invalid Ori Unix socket path");
    }
    await expect(
      startOriMig04PgSharedAuthProductionHost({ ...options, connectionString: "" }),
    ).rejects.toThrow("durable PostgreSQL");
  });

  it("rejects invalid trusted deployment IDs and listener ports before opening PostgreSQL", async () => {
    for (const deploymentId of ["", "../unsafe", "bad id", "x".repeat(129)]) {
      await expect(
        startOriMig04PgSharedAuthProductionHost({
          ...options,
          ori: { ...options.ori, deploymentId },
        }),
      ).rejects.toThrow("Invalid MIG-04 deployment ID");
    }
    for (const port of [-1, 65536, 1.5, Number.NaN]) {
      await expect(
        startOriMig04PgSharedAuthProductionHost({ ...options, port }),
      ).rejects.toThrow("Invalid MIG-04 listener port");
    }
  });

  it("closes shared AuthService pool when integrated startup fails", async () => {
    await expect(startOriMig04PgSharedAuthProductionHost(options)).rejects.toThrow();
  });
});
