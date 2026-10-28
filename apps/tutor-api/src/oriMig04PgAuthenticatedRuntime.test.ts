import { describe, expect, it } from "vitest";
import { createOriMig04PgNodePool } from "./oriMig04PgNodePool.js";
import { startOriMig04PgAuthenticatedRuntime } from "./oriMig04PgAuthenticatedRuntime.js";
import { configFromEnv } from "./index.js";

describe("MIG-04 real authenticated PostgreSQL runtime", () => {
  it("rejects malformed PostgreSQL connection strings", () => {
    expect(() => createOriMig04PgNodePool("")).toThrow("Invalid Ori PostgreSQL");
    expect(() => createOriMig04PgNodePool("sqlite:///tmp/ori.db")).toThrow(
      "Invalid Ori PostgreSQL",
    );
  });
  it("rejects invalid ports before acquiring PostgreSQL", async () => {
    await expect(
      startOriMig04PgAuthenticatedRuntime({
        connectionString: "postgresql://localhost/ori",
        tutor: { config: configFromEnv({}) },
        ori: {} as never,
        port: -1,
      }),
    ).rejects.toThrow("Invalid Ori host port");
  });
  it("refuses startup when PostgreSQL is unavailable", async () => {
    await expect(
      startOriMig04PgAuthenticatedRuntime({
        connectionString: "postgresql://127.0.0.1:1/ori?connect_timeout=1",
        tutor: { config: configFromEnv({}) },
        ori: { deploymentId: "ori" } as never,
      }),
    ).rejects.toThrow();
  });
});
