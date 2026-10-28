import { describe, expect, it } from "vitest";
import { emergencyDisableOriPgRollout } from "./oriMig04PostgresEmergencyDisable.js";
import type { OriPgTransaction } from "./oriMig04PostgresAtomicCas.js";

describe("MIG-04 durable emergency disable contract", () => {
  it("increments epoch, disables rollout, and removes allowlist atomically", async () => {
    const queries: string[] = [];
    const tx: OriPgTransaction = {
      async query<Row extends Record<string, unknown>>(sql: string) {
        queries.push(sql);
        return {
          rows: (queries.length === 1 ? [{ epoch: "9" }] : []) as unknown as readonly Row[],
        };
      },
    };
    const epoch = await emergencyDisableOriPgRollout(
      { transaction: async (work) => work(tx) },
      "ori",
    );
    expect(epoch).toBe(9);
    expect(queries[0]).toContain("epoch = epoch + 1");
    expect(queries[0]).toContain("kill_switch = true");
    expect(queries[1]).toContain("delete from agorix_ori_rollout_projects");
  });

  it("fails closed when policy row does not exist", async () => {
    let statements = 0;
    const tx: OriPgTransaction = {
      async query<Row extends Record<string, unknown>>() {
        statements++;
        return { rows: [] as readonly Row[] };
      },
    };
    await expect(
      emergencyDisableOriPgRollout({ transaction: async (work) => work(tx) }, "missing"),
    ).rejects.toThrow("rollback unconfirmed");
    expect(statements).toBe(1);
  });

  it("rejects an invalid deployment before opening a transaction", async () => {
    let invoked = false;
    await expect(
      emergencyDisableOriPgRollout(
        {
          transaction: async <T>(_work: (tx: OriPgTransaction) => Promise<T>): Promise<T> => {
            invoked = true;
            throw new Error("transaction must not be invoked");
          },
        },
        "",
      ),
    ).rejects.toThrow("Invalid");
    expect(invoked).toBe(false);
  });
});
