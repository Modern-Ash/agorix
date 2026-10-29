import { describe, expect, it } from "vitest";
import { createOriMig04PgPersistencePort } from "./oriMig04PgPersistencePort.js";
import type { OriPgTransaction } from "./oriMig04PostgresAtomicCas.js";

describe("MIG-04 PostgreSQL persistence port", () => {
  it("rejects invalid deployment configuration", () => {
    expect(() =>
      createOriMig04PgPersistencePort(
        {
          transaction: async <T>(_work: (tx: OriPgTransaction) => Promise<T>): Promise<T> => {
            throw Error("should not run");
          },
        },
        "",
      ),
    ).toThrow("Invalid Ori deployment");
  });
  it("runs emergency disable through the transaction provider", async () => {
    const queries: string[] = [];
    const tx: OriPgTransaction = {
      async query<Row extends Record<string, unknown>>(sql: string) {
        queries.push(sql);
        return {
          rows: (queries.length === 1 ? [{ epoch: "12" }] : []) as unknown as readonly Row[],
        };
      },
    };
    const port = createOriMig04PgPersistencePort(
      {
        transaction: async (work) => work(tx),
      },
      "deployment",
    );
    expect(await port.emergencyDisable()).toBe(12);
    expect(queries).toHaveLength(2);
    expect(queries[0]).toContain("where deployment_id = $1");
    expect(queries[1]).toContain("delete from agorix_ori_rollout_projects");
  });
});
