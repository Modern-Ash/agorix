import { describe, expect, it } from "vitest";
import { configFromEnv } from "./index.js";
import { startOriMig04PgCanonicalAuthenticatedRuntime } from "./oriMig04PgCanonicalAuthenticatedRuntime.js";

describe("MIG-04 canonical authenticated runtime", () => {
  it("rejects invalid port before constructing the pool", async () => {
    await expect(
      startOriMig04PgCanonicalAuthenticatedRuntime({
        connectionString: "postgresql://localhost/ori",
        tutor: { config: configFromEnv({}) },
        ori: {} as never,
        port: -1,
      }),
    ).rejects.toThrow("Invalid Ori host port");
  });

  it("fails closed when trusted auth providers are missing", async () => {
    await expect(
      startOriMig04PgCanonicalAuthenticatedRuntime({
        connectionString: "postgresql://127.0.0.1:1/ori",
        tutor: { config: configFromEnv({}) },
        ori: { deploymentId: "ori" } as never,
      }),
    ).rejects.toThrow("Missing trusted Ori runtime dependencies");
  });

  it("does not listen if the durable policy cannot be checked", async () => {
    await expect(
      startOriMig04PgCanonicalAuthenticatedRuntime({
        connectionString: "postgresql://127.0.0.1:1/ori?connect_timeout=1",
        tutor: { config: configFromEnv({}) },
        ori: {
          deploymentId: "ori",
          auth: {
            resolveSession: async () => {
              throw Error("unused");
            },
          },
          sessionToken: () => null,
          activeProject: async () => null,
          learningContext: async () => null,
          rolloutDecide: () => ({ learnerVisible: false }),
          oriRoot: "/trusted/ori",
          world: {},
        },
      }),
    ).rejects.toThrow();
  });
});
