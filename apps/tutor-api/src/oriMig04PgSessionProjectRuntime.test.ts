import { describe, expect, it } from "vitest";
import { configFromEnv } from "./index.js";
import { startOriMig04PgSessionProjectRuntime } from "./oriMig04PgSessionProjectRuntime.js";

describe("MIG-04 session project runtime composition", () => {
  it("rejects missing server-owned project store before connecting", () => {
    expect(() =>
      startOriMig04PgSessionProjectRuntime({
        connectionString: "postgresql://127.0.0.1:1/ori",
        tutor: { config: configFromEnv({}) },
        projectStore: {} as never,
        ori: {} as never,
      }),
    ).toThrow("Missing trusted Ori session-project store");
  });
});
