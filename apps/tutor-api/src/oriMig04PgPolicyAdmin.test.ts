import { describe, expect, it } from "vitest";
import { replaceOriPgRolloutPolicy } from "./oriMig04PgPolicyAdmin.js";
import type { OriPgTransaction } from "./oriMig04PostgresAtomicCas.js";

describe("MIG-04 trusted PostgreSQL rollout administration", () => {
  it("increments epoch and replaces pilot allowlist in one transaction", async () => {
    const sql: string[] = [];
    const provider = {
      transaction: async <T>(work: (tx: OriPgTransaction) => Promise<T>): Promise<T> =>
        work({
          async query<Row extends Record<string, unknown>>(statement: string) {
            sql.push(statement);
            return {
              rows: (sql.length === 1 ? [{ epoch: "5" }] : []) as unknown as readonly Row[],
            };
          },
        }),
    };
    expect(
      await replaceOriPgRolloutPolicy(provider, "ori", {
        mode: "pilot",
        humanAuthorized: true,
        killSwitch: false,
        approvedProjectIds: ["one", "one", "two"],
      }),
    ).toBe(5);
    expect(sql).toHaveLength(4);
    expect(sql[0]).toContain("on conflict");
    expect(sql[1]).toContain("delete from agorix_ori_rollout_projects");
  });

  it("rejects pilot without human approval before opening a transaction", async () => {
    let invoked = false;
    const provider = {
      transaction: async <T>(_work: (tx: OriPgTransaction) => Promise<T>): Promise<T> => {
        invoked = true;
        throw Error("must not run");
      },
    };
    await expect(
      replaceOriPgRolloutPolicy(provider, "ori", {
        mode: "pilot",
        humanAuthorized: false,
        killSwitch: false,
        approvedProjectIds: ["one"],
      }),
    ).rejects.toThrow("explicit authorization");
    expect(invoked).toBe(false);
  });
  it("rejects non-pilot policies that retain authorization", async () => {
    let invoked = false;
    const provider = {
      transaction: async <T>(_work: (tx: OriPgTransaction) => Promise<T>): Promise<T> => {
        invoked = true;
        throw Error("must not run");
      },
    };
    for (const config of [
      { mode: "disabled" as const, humanAuthorized: true, killSwitch: true, approvedProjectIds: [] },
      { mode: "shadow" as const, humanAuthorized: false, killSwitch: false, approvedProjectIds: [] },
    ]) {
      await expect(replaceOriPgRolloutPolicy(provider, "ori", config)).rejects.toThrow(
        "fail-closed",
      );
    }
    expect(invoked).toBe(false);
  });
  it("rejects invalid deployment identifiers", async () => {
    const provider = {
      transaction: async <T>(_work: (tx: OriPgTransaction) => Promise<T>): Promise<T> => {
        throw Error("must not run");
      },
    };
    await expect(replaceOriPgRolloutPolicy(provider, "bad deployment", {
      mode: "disabled", humanAuthorized: false, killSwitch: true, approvedProjectIds: [],
    })).rejects.toThrow("Invalid Ori rollout configuration");
  });
});
