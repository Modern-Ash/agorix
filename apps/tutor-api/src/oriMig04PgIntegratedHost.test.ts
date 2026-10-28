import { describe, expect, it } from "vitest";
import { configFromEnv } from "./index.js";
import { startOriMig04PgIntegratedHost } from "./oriMig04PgIntegratedHost.js";

describe("MIG-04 integrated production host", () => {
  it("rejects an invalid listener port before opening PostgreSQL", async () => {
    await expect(
      startOriMig04PgIntegratedHost({
        connectionString: "postgresql://127.0.0.1:1/ori",
        tutor: { config: configFromEnv({}) },
        ori: {} as never,
        port: -1,
      }),
    ).rejects.toThrow("Invalid Ori host port");
  });

  it("rejects missing real AuthService before opening PostgreSQL", async () => {
    await expect(
      startOriMig04PgIntegratedHost({
        connectionString: "postgresql://127.0.0.1:1/ori",
        tutor: { config: configFromEnv({}) },
        ori: { deploymentId: "ori" } as never,
      }),
    ).rejects.toThrow("Missing trusted Ori runtime dependencies");
  });

  it("refuses startup when PostgreSQL is unreachable", async () => {
    await expect(
      startOriMig04PgIntegratedHost({
        connectionString: "postgresql://127.0.0.1:1/ori?connect_timeout=1",
        tutor: { config: configFromEnv({}) },
        ori: {
          deploymentId: "ori",
          auth: {
            resolveSession: async () => {
              throw Error("unavailable");
            },
          },
          oriRoot: "/trusted/ori",
          world: {},
          learningContext: async () => null,
          rolloutDecide: () => ({ learnerVisible: false }),
        },
      }),
    ).rejects.toThrow();
  });
});
