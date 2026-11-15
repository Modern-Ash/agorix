import { describe, expect, it } from "vitest";
import { assertOriMig04PgSessionMappingReadiness } from "./oriMig04PgSessionMappingReadiness.js";

const columns = ["account_id", "session_id", "project_id", "updated_at"];

describe("MIG-04 durable session project schema readiness", () => {
  it("accepts a complete session project mapping schema", async () => {
    const pool = {
      query: async () => ({ rows: columns.map((column_name) => ({ column_name })) }),
    };
    await expect(assertOriMig04PgSessionMappingReadiness(pool as never)).resolves.toBeUndefined();
  });

  it("rejects absent and incomplete mapping tables", async () => {
    for (const missing of columns) {
      const pool = {
        query: async () => ({
          rows: columns
            .filter((column) => column !== missing)
            .map((column_name) => ({ column_name })),
        }),
      };
      await expect(assertOriMig04PgSessionMappingReadiness(pool as never)).rejects.toThrow(
        "requires durable session project schema",
      );
    }
    await expect(
      assertOriMig04PgSessionMappingReadiness({
        query: async () => ({ rows: [] }),
      } as never),
    ).rejects.toThrow("requires durable session project schema");
  });
});
