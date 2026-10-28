import { describe, expect, it } from "vitest";
import {
  commitOriProjectWithPgFence,
  type OriPgTransaction,
} from "./oriMig04PostgresAtomicCas.js";

const input = {
  deploymentId: "ori", ownerId: "owner", projectId: "pilot",
  expectedEpoch: 4, expectedRevision: 2,
  storedProjectJson: "{}", semanticHash: "hash", updatedAt: "2026-10-27",
};

function run(rows: readonly (readonly Record<string, unknown>[])[]) {
  const statements: string[] = [];
  let index = 0;
  const tx: OriPgTransaction = {
    async query<Row extends Record<string, unknown>>(sql: string) {
      statements.push(sql);
      return { rows: (rows[index++] ?? []) as readonly Row[] };
    },
  };
  return {
    statements,
    commit: () => commitOriProjectWithPgFence(
      { transaction: async (work) => work(tx) }, input,
    ),
  };
}
const policy = { epoch: "4", mode: "pilot", human_authorized: true, kill_switch: false };

describe("MIG-04 PostgreSQL atomic CAS query contract", () => {
  it("rejects missing policy without writing", async () => {
    const test = run([[]]);
    expect(await test.commit()).toBe("denied");
    expect(test.statements).toHaveLength(1);
  });
  it("rejects revoked or stale policy before project mutation", async () => {
    for (const denied of [
      { ...policy, epoch: "5" },
      { ...policy, kill_switch: true },
      { ...policy, human_authorized: false },
      { ...policy, mode: "shadow" },
    ]) {
      const test = run([[denied]]);
      expect(await test.commit()).toBe("denied");
      expect(test.statements).toHaveLength(1);
    }
  });
  it("requires allowlist membership", async () => {
    const test = run([[policy], []]);
    expect(await test.commit()).toBe("denied");
    expect(test.statements).toHaveLength(2);
  });
  it("commits exactly one CAS update after locking policy", async () => {
    const test = run([[policy], [{ project_id: "pilot" }], [{ revision: 3 }]]);
    expect(await test.commit()).toBe("applied");
    expect(test.statements[0]).toContain("for update");
    expect(test.statements[2]).toContain("revision = $6");
  });
  it("reports revision conflict when CAS returns no row", async () => {
    const test = run([[policy], [{ project_id: "pilot" }], []]);
    expect(await test.commit()).toBe("conflict");
  });
});
