import { describe, expect, it } from "vitest";
import { createOriMig04PgEpochResolver } from "./oriMig04PgEpochResolver.js";
import type { OriPgTransaction } from "./oriMig04PostgresAtomicCas.js";

function provider(rows: readonly (readonly Record<string, unknown>[])[]) {
  let calls = 0;
  return {
    transaction: async <T>(work: (tx: OriPgTransaction) => Promise<T>): Promise<T> =>
      work({
        async query<Row extends Record<string, unknown>>() {
          return { rows: (rows[calls++] ?? []) as readonly Row[] };
        },
      }),
  };
}
const pilot = { epoch: "7", mode: "pilot", human_authorized: true, kill_switch: false };

describe("MIG-04 PostgreSQL trusted epoch resolver", () => {
  it("returns epoch only for a permitted pilot project", async () => {
    const resolve = createOriMig04PgEpochResolver(
      provider([[pilot], [{ project_id: "pilot" }]]), "ori",
    );
    expect(await resolve("owner", "pilot")).toEqual({ deploymentId: "ori", epoch: 7 });
  });
  it("fails closed for missing, disabled or unauthorized policy", async () => {
    for (const policy of [
      null,
      { ...pilot, kill_switch: true },
      { ...pilot, human_authorized: false },
      { ...pilot, mode: "shadow" },
      { ...pilot, epoch: "not-a-number" },
    ]) {
      const resolve = createOriMig04PgEpochResolver(
        provider([policy ? [policy] : [], [{ project_id: "pilot" }]]), "ori",
      );
      expect(await resolve("owner", "pilot")).toBeNull();
    }
  });
  it("rejects projects absent from allowlist", async () => {
    const resolve = createOriMig04PgEpochResolver(provider([[pilot], []]), "ori");
    expect(await resolve("owner", "other")).toBeNull();
  });
  it("fails closed on database error", async () => {
    const resolve = createOriMig04PgEpochResolver({
      transaction: async <T>(_work: (tx: OriPgTransaction) => Promise<T>): Promise<T> => {
        throw Error("db unavailable");
      },
    }, "ori");
    expect(await resolve("owner", "pilot")).toBeNull();
  });
});
