import { describe, expect, it } from "vitest";
import { createOriMig04PgAuthSessionRepository } from "./oriMig04PgAuthSessionRepository.js";

describe("MIG-04 shared PostgreSQL AuthService sessions", () => {
  it("reads only by hashed token and never exposes raw tokens in SQL", async () => {
    const queries: Array<{ sql: string; params: unknown[] }> = [];
    const repository = createOriMig04PgAuthSessionRepository({
      query: async (sql: string, params: unknown[]) => {
        queries.push({ sql, params });
        return { rows: [] } as never;
      },
    } as never);
    expect(await repository.findByTokenHash("hashed-token")).toBeUndefined();
    expect(queries[0]?.params).toEqual(["hashed-token"]);
    expect(queries[0]?.sql).toContain("token_hash = $1");
  });

  it("fails closed when concurrent rotation has already consumed the old token", async () => {
    const repository = createOriMig04PgAuthSessionRepository({
      query: async () => ({ rowCount: 0 }) as never,
    } as never);
    await expect(
      repository.replace(
        "old",
        {
          tokenHash: "new",
          session: { accountId: "owner" },
        } as never,
        new Date().toISOString(),
      ),
    ).rejects.toThrow("Auth session rotation conflict");
  });

  it("revokes and deletes by parameterized token hash and account", async () => {
    const calls: unknown[][] = [];
    const repository = createOriMig04PgAuthSessionRepository({
      query: async (_sql: string, params: unknown[]) => {
        calls.push(params);
        return { rowCount: 1 } as never;
      },
    } as never);
    await repository.revoke("hash", "2026-10-28T00:00:00.000Z");
    await repository.deleteForAccount("owner");
    expect(calls).toEqual([["hash", "2026-10-28T00:00:00.000Z"], ["owner"]]);
  });
});
