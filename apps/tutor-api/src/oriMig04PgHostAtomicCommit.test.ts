import { describe, expect, it } from "vitest";
import { createOriMig04PgHostAtomicCommit } from "./oriMig04PgHostAtomicCommit.js";
import type { OriPgTransaction } from "./oriMig04PostgresAtomicCas.js";

describe("MIG-04 trusted host epoch adapter", () => {
  it("rejects absent or foreign rollout context without touching PostgreSQL", async () => {
    for (const context of [null, { deploymentId: "other", epoch: 1 }]) {
      let transactions = 0;
      const adapter = createOriMig04PgHostAtomicCommit({
        provider: {
          transaction: async <T>(_work: (tx: OriPgTransaction) => Promise<T>): Promise<T> => {
            transactions++;
            throw Error("must not open transaction");
          },
        },
        deploymentId: "ori",
        resolveEpoch: async () => context,
      });
      expect(await adapter.commit("owner", "project", {} as never, 1)).toBe("denied");
      expect(transactions).toBe(0);
    }
  });
});
