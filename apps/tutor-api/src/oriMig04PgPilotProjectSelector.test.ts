import { describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { createOriMig04PgPilotProjectSelector } from "./oriMig04PgPilotProjectSelector.js";

describe("MIG-04 private project selection", () => {
  it("requires one active, verified, allowlisted project from the database", async () => {
    let rows: { project_id: string }[] = [{ project_id: "reviewed" }];
    const calls: { sql: string; values: unknown[] }[] = [];
    const pool = {
      async query(sql: string, values: unknown[]) {
        calls.push({ sql, values });
        return { rows };
      },
    } as unknown as Pick<Pool, "query">;
    const select = createOriMig04PgPilotProjectSelector({
      pool,
      deploymentId: "private",
      allowedAdultEmail: " Owner@Example.test ",
    });
    expect(await select({ accountId: "account-1", sessionId: "session-1" })).toBe("reviewed");
    expect(calls[0]?.values).toEqual(["private", "account-1", "owner@example.test"]);
    expect(calls[0]?.sql).toContain("e.verified_at is not null");
    expect(calls[0]?.sql).toContain("policy.kill_switch = false");
    rows = [];
    expect(await select({ accountId: "account-1", sessionId: "session-1" })).toBeNull();
    rows = [{ project_id: "one" }, { project_id: "two" }];
    expect(await select({ accountId: "account-1", sessionId: "session-1" })).toBeNull();
    expect(await select({ accountId: "", sessionId: "session-1" })).toBeNull();
  });
});
