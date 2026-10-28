import { describe, expect, it } from "vitest";
import { createOriMig04PgTrustedComposition } from "./oriMig04PgTrustedComposition.js";
import type { OriPgTransaction } from "./oriMig04PostgresAtomicCas.js";

describe("MIG-04 trusted PostgreSQL composition", () => {
  it("fails closed when shared policy does not exist", async () => {
    let queries = 0;
    const composition = createOriMig04PgTrustedComposition({
      provider: {
        transaction: async (work) =>
          work({
            async query<Row extends Record<string, unknown>>() {
              queries++;
              return { rows: [] as readonly Row[] };
            },
          } satisfies OriPgTransaction),
      },
      deploymentId: "ori",
    });
    expect(await composition.oriMig04AtomicCommit("owner", "project", {} as never, 1)).toBe(
      "denied",
    );
    expect(queries).toBe(1);
  });
});
