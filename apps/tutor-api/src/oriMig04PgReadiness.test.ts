import { describe, expect, it } from "vitest";
import { assertOriMig04PgReadiness } from "./oriMig04PgReadiness.js";

describe("MIG-04 durable startup readiness", () => {
  it("accepts only an explicitly disabled durable policy", async () => {
    let releases = 0;
    const pool = {
      connect: async () => ({
        query: async <Row extends Record<string, unknown>>() => ({
          rows: [
            { mode: "disabled", human_authorized: false, kill_switch: true },
          ] as unknown as readonly Row[],
        }),
        release: () => {
          releases++;
        },
      }),
    };
    await expect(assertOriMig04PgReadiness(pool, "ori")).resolves.toBeUndefined();
    expect(releases).toBe(1);
  });
  it("denies missing or active policy and always releases the client", async () => {
    for (const rows of [
      [],
      [{ mode: "pilot", human_authorized: true, kill_switch: false }],
      [{ mode: "disabled", human_authorized: false, kill_switch: false }],
    ]) {
      let releases = 0;
      const pool = {
        connect: async () => ({
          query: async <Row extends Record<string, unknown>>() => ({
            rows: rows as readonly Row[],
          }),
          release: () => {
            releases++;
          },
        }),
      };
      await expect(assertOriMig04PgReadiness(pool, "ori")).rejects.toThrow(
        "durable disabled policy",
      );
      expect(releases).toBe(1);
    }
  });
  it("rejects invalid deployment identifiers before connecting", async () => {
    let connections = 0;
    await expect(
      assertOriMig04PgReadiness(
        {
          connect: async () => {
            connections++;
            throw Error("should not connect");
          },
        },
        "bad deployment",
      ),
    ).rejects.toThrow("Invalid Ori deployment identifier");
    expect(connections).toBe(0);
  });
});
