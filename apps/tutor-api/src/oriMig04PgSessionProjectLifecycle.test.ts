import { describe, expect, it } from "vitest";
import { createOriMig04PgSessionProjectLifecycle } from "./oriMig04PgSessionProjectLifecycle.js";

describe("MIG-04 session project lifecycle", () => {
  it("selects a project using an owner-filtered SQL statement", async () => {
    const queries: Array<{ sql: string; params: unknown[] }> = [];
    const lifecycle = createOriMig04PgSessionProjectLifecycle({
      query: async (sql: string, params: unknown[]) => {
        queries.push({ sql, params });
        return { rowCount: 1 } as never;
      },
    } as never);
    await lifecycle.select("owner", "session", "project");
    expect(queries[0]?.sql).toContain("p.owner_id = $1");
    expect(queries[0]?.params).toEqual(["owner", "session", "project"]);
  });

  it("denies project selection when ownership is absent", async () => {
    const lifecycle = createOriMig04PgSessionProjectLifecycle({
      query: async () => ({ rowCount: 0 }) as never,
    } as never);
    await expect(lifecycle.select("owner", "session", "other")).rejects.toThrow(
      "ownership denied",
    );
  });

  it("revokes and rotates only the authenticated session mapping", async () => {
    const queries: unknown[][] = [];
    const lifecycle = createOriMig04PgSessionProjectLifecycle({
      query: async (_sql: string, params: unknown[]) => {
        queries.push(params);
        return { rowCount: 1 } as never;
      },
    } as never);
    await lifecycle.rotate("owner", "old", "new");
    await lifecycle.revoke("owner", "new");
    expect(queries).toEqual([
      ["owner", "old", "new"],
      ["owner", "new"],
    ]);
  });

  it("revokes every mapping for an account without touching another owner", async () => {
    const statements: Array<{ sql: string; params: unknown[] }> = [];
    const lifecycle = createOriMig04PgSessionProjectLifecycle({
      query: async (sql: string, params: unknown[]) => {
        statements.push({ sql, params });
        return { rowCount: 2 } as never;
      },
    } as never);
    await lifecycle.revokeAll("owner");
    expect(statements).toEqual([
      {
        sql: "delete from agorix_ori_session_projects where account_id = $1",
        params: ["owner"],
      },
    ]);
    await expect(lifecycle.revokeAll("../other")).rejects.toThrow(
      "Invalid Ori session project identity",
    );
    expect(statements).toHaveLength(1);
  });

  it("rejects malformed identity before SQL access", async () => {
    let calls = 0;
    const lifecycle = createOriMig04PgSessionProjectLifecycle({
      query: async () => {
        calls++;
        return { rowCount: 1 } as never;
      },
    } as never);
    await expect(lifecycle.select("owner", "session", "../other")).rejects.toThrow(
      "Invalid Ori session project identity",
    );
    expect(calls).toBe(0);
  });
});
