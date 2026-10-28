import { describe, expect, it } from "vitest";
import { createOriMig04PgHostWiring } from "./oriMig04PgHostWiring.js";

describe("MIG-04 PostgreSQL host wiring", () => {
  it("uses a pinned client and denies commits when policy is absent", async () => {
    const sql: string[] = [];
    let released = 0;
    const wiring = createOriMig04PgHostWiring({
      deploymentId: "ori",
      pool: {
        connect: async () => ({
          async query<Row extends Record<string, unknown>>(statement: string) {
            sql.push(statement);
            return { rows: [] as readonly Row[] };
          },
          release() {
            released++;
          },
        }),
      },
    });
    expect(await wiring.oriMig04AtomicCommit("owner", "pilot", {} as never, 1)).toBe("denied");
    expect(sql).toEqual([
      "BEGIN",
      expect.stringContaining("from agorix_ori_rollout_policy"),
      "COMMIT",
    ]);
    expect(released).toBe(1);
  });
  it("fails closed and releases connection when policy lookup fails", async () => {
    const sql: string[] = [];
    let released = 0;
    const wiring = createOriMig04PgHostWiring({
      deploymentId: "ori",
      pool: {
        connect: async () => ({
          async query<Row extends Record<string, unknown>>(statement: string) {
            sql.push(statement);
            if (statement.includes("from agorix_ori_rollout_policy")) {
              throw new Error("database unavailable");
            }
            return { rows: [] as readonly Row[] };
          },
          release() {
            released++;
          },
        }),
      },
    });
    expect(await wiring.oriMig04AtomicCommit("owner", "pilot", {} as never, 1)).toBe("denied");
    expect(sql[0]).toBe("BEGIN");
    expect(sql.at(-1)).toBe("ROLLBACK");
    expect(released).toBe(1);
  });
  it("does not open a connection for empty project identifiers", async () => {
    let connections = 0;
    const wiring = createOriMig04PgHostWiring({
      deploymentId: "ori",
      pool: {
        connect: async () => {
          connections++;
          throw Error("should not connect");
        },
      },
    });
    expect(await wiring.oriMig04AtomicCommit("owner", "", {} as never, 1)).toBe("denied");
    expect(connections).toBe(0);
  });
});
