import { describe, expect, it } from "vitest";
import { assertOriMig04PgAuthSchemaReadiness } from "./oriMig04PgAuthSchemaReadiness.js";

const required = [
  ["agorix_auth_accounts", "account_id"],
  ["agorix_auth_accounts", "normalized_username"],
  ["agorix_auth_accounts", "record"],
  ["agorix_auth_sessions", "token_hash"],
  ["agorix_auth_sessions", "account_id"],
  ["agorix_auth_sessions", "record"],
] as const;

describe("MIG-04 shared AuthService startup readiness", () => {
  it("accepts complete account and session schemas", async () => {
    const pool = {
      query: async () => ({
        rows: required.map(([table_name, column_name]) => ({ table_name, column_name })),
      }),
    };
    await expect(assertOriMig04PgAuthSchemaReadiness(pool as never)).resolves.toBeUndefined();
  });

  it("denies missing tables or individual columns", async () => {
    for (const missing of required) {
      const pool = {
        query: async () => ({
          rows: required
            .filter(([table, column]) => table !== missing[0] || column !== missing[1])
            .map(([table_name, column_name]) => ({ table_name, column_name })),
        }),
      };
      await expect(assertOriMig04PgAuthSchemaReadiness(pool as never)).rejects.toThrow(
        "requires durable AuthService account and session schemas",
      );
    }
  });

  it("denies both tables absent", async () => {
    const pool = { query: async () => ({ rows: [] }) };
    await expect(assertOriMig04PgAuthSchemaReadiness(pool as never)).rejects.toThrow(
      "requires durable AuthService account and session schemas",
    );
  });
});
