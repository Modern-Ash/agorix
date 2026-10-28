import { describe, expect, it } from "vitest";
import {
  createOriMig04PgSessionProjectStore,
  ORI_MIG04_SESSION_PROJECT_SCHEMA_SQL,
} from "./oriMig04PgSessionProjectStore.js";

describe("MIG-04 PostgreSQL session project store", () => {
  it("uses parameterized account and session identity only", async () => {
    const calls: unknown[][] = [];
    const store = createOriMig04PgSessionProjectStore({
      query: async (_sql: string, values: unknown[]) => {
        calls.push(values);
        return { rows: [{ project_id: "project_1" }] } as never;
      },
    } as never);
    expect(await store.getActiveProject("owner", "session")).toBe("project_1");
    expect(calls).toEqual([["owner", "session"]]);
  });

  it("returns null for absent mapping", async () => {
    const store = createOriMig04PgSessionProjectStore({
      query: async () => ({ rows: [] }) as never,
    } as never);
    expect(await store.getActiveProject("owner", "session")).toBeNull();
  });

  it("declares one mapping per account and session", () => {
    expect(ORI_MIG04_SESSION_PROJECT_SCHEMA_SQL).toContain("primary key (account_id, session_id)");
  });
});
