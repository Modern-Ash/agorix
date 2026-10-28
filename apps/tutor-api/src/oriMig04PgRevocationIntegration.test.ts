import { describe, expect, it } from "vitest";
import { createOriMig04PgTrustedComposition } from "./oriMig04PgTrustedComposition.js";
import type { OriPgTransaction } from "./oriMig04PostgresAtomicCas.js";

/**
 * Shared-policy simulation at the SQL contract boundary. Real multi-connection
 * PostgreSQL integration tests remain a separate production gate.
 */
describe("MIG-04 revocation invalidates stale trusted epochs", () => {
  it("rejects a previously approved project after emergency disable", async () => {
    let epoch = 3;
    let disabled = false;
    let writes = 0;
    const provider = {
      transaction: async <T>(work: (tx: OriPgTransaction) => Promise<T>): Promise<T> =>
        work({
          async query<Row extends Record<string, unknown>>(sql: string) {
            if (sql.startsWith("select epoch")) {
              return {
                rows: (disabled
                  ? [{ epoch: String(epoch), mode: "disabled", human_authorized: false, kill_switch: true }]
                  : [{ epoch: String(epoch), mode: "pilot", human_authorized: true, kill_switch: false }]) as unknown as readonly Row[],
              };
            }
            if (sql.startsWith("select project_id")) {
              return { rows: [{ project_id: "pilot" }] as unknown as readonly Row[] };
            }
            if (sql.startsWith("update agorix_ori_rollout_policy")) {
              disabled = true;
              epoch++;
              return { rows: [{ epoch: String(epoch) }] as unknown as readonly Row[] };
            }
            if (sql.startsWith("delete from agorix_ori_rollout_projects")) {
              return { rows: [] as readonly Row[] };
            }
            if (sql.startsWith("update agorix_projects")) {
              writes++;
              return { rows: [{ revision: 2 }] as unknown as readonly Row[] };
            }
            return { rows: [] as readonly Row[] };
          },
        }),
    };
    const composition = createOriMig04PgTrustedComposition({
      provider,
      deploymentId: "ori",
    });
    expect(await composition.emergencyDisable()).toBe(4);
    expect(disabled).toBe(true);
    expect(await composition.oriMig04AtomicCommit("owner", "pilot", {} as never, 1)).toBe("denied");
    expect(writes).toBe(0);
  });
});
