import { describe, expect, it } from "vitest";
import { createOriMig04PgProjectRepository } from "./oriMig04PgProjectRepository.js";

describe("MIG-04 canonical PostgreSQL repository composition", () => {
  it("queries the shared SQL pool with parameterized owner and project identifiers", async () => {
    const calls: Array<{ sql: string; params: unknown[] }> = [];
    const repository = createOriMig04PgProjectRepository({
      query: async (sql: string, params: unknown[]) => {
        calls.push({ sql, params });
        return { rows: [], rowCount: 0 } as never;
      },
    } as never);
    await expect(repository.get("owner", "project")).rejects.toThrow();
    expect(calls).toHaveLength(1);
    expect(calls[0]?.sql).toContain("agorix_projects");
    expect(calls[0]?.params).toEqual(["owner", "project"]);
  });
});
