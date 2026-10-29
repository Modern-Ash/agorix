import { describe, expect, it } from "vitest";
import {
  createOriPgTransactionProvider,
  type OriPgClient,
} from "./oriMig04PgTransactionProvider.js";

function fixture(failAt?: string) {
  const statements: string[] = [];
  let released = 0;
  const client: OriPgClient = {
    async query<Row extends Record<string, unknown>>(sql: string) {
      statements.push(sql);
      if (sql === failAt) throw new Error("database failed");
      return { rows: [] as readonly Row[] };
    },
    release() {
      released++;
    },
  };
  const provider = createOriPgTransactionProvider({
    connect: async () => client,
  });
  return { provider, statements, released: () => released };
}

describe("MIG-04 PostgreSQL transaction provider", () => {
  it("commits and releases the same client on success", async () => {
    const test = fixture();
    await test.provider.transaction(async (tx) => {
      await tx.query("SELECT 1", []);
    });
    expect(test.statements).toEqual(["BEGIN", "SELECT 1", "COMMIT"]);
    expect(test.released()).toBe(1);
  });
  it("rolls back and releases on callback failure", async () => {
    const test = fixture("SELECT 1");
    await expect(
      test.provider.transaction(async (tx) => {
        await tx.query("SELECT 1", []);
      }),
    ).rejects.toThrow("database failed");
    expect(test.statements).toEqual(["BEGIN", "SELECT 1", "ROLLBACK"]);
    expect(test.released()).toBe(1);
  });
  it("does not commit when BEGIN fails", async () => {
    const test = fixture("BEGIN");
    await expect(test.provider.transaction(async () => "unreachable")).rejects.toThrow();
    expect(test.statements).toEqual(["BEGIN"]);
    expect(test.released()).toBe(1);
  });
  it("rolls back when COMMIT fails", async () => {
    const test = fixture("COMMIT");
    await expect(test.provider.transaction(async () => "result")).rejects.toThrow();
    expect(test.statements).toEqual(["BEGIN", "COMMIT", "ROLLBACK"]);
    expect(test.released()).toBe(1);
  });
});
