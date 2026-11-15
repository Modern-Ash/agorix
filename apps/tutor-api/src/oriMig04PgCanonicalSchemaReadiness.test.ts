import { describe, expect, it } from "vitest";
import { assertOriMig04PgCanonicalSchemaReadiness } from "./oriMig04PgCanonicalSchemaReadiness.js";

const columns = [
  "owner_id",
  "project_id",
  "title",
  "revision",
  "created_at",
  "updated_at",
  "stored_project_json",
  "semantic_hash",
];

describe("MIG-04 canonical PostgreSQL schema readiness", () => {
  it("accepts a complete canonical table without modifying it", async () => {
    let calls = 0;
    const pool = {
      query: async () => {
        calls++;
        return { rows: columns.map((column_name) => ({ column_name })) };
      },
    };
    await expect(assertOriMig04PgCanonicalSchemaReadiness(pool as never)).resolves.toBeUndefined();
    expect(calls).toBe(1);
  });

  it("rejects a missing table or any missing canonical column", async () => {
    for (const missing of [undefined, ...columns]) {
      const pool = {
        query: async () => ({
          rows: columns
            .filter((column) => missing !== undefined && column !== missing)
            .map((column_name) => ({ column_name })),
        }),
      };
      await expect(assertOriMig04PgCanonicalSchemaReadiness(pool as never)).rejects.toThrow(
        "requires canonical PostgreSQL project schema",
      );
    }
  });
});
