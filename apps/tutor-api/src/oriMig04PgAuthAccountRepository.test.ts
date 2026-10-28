import { describe, expect, it } from "vitest";
import { createOriMig04PgAuthAccountRepository } from "./oriMig04PgAuthAccountRepository.js";

describe("MIG-04 shared AuthService account repository", () => {
  it("uses parameterized account and normalized username lookups", async () => {
    const queries: unknown[][] = [];
    const repository = createOriMig04PgAuthAccountRepository({
      query: async (_sql: string, params: unknown[]) => {
        queries.push(params);
        return { rows: [] } as never;
      },
    } as never);
    expect(await repository.findByAccountId("owner")).toBeUndefined();
    expect(await repository.findByNormalizedUsername("learner")).toBeUndefined();
    expect(queries).toEqual([["owner"], ["learner"]]);
  });

  it("rejects credential updates for absent accounts", async () => {
    const repository = createOriMig04PgAuthAccountRepository({
      query: async () => ({ rowCount: 0 }) as never,
    } as never);
    await expect(repository.updateCredential("missing", {} as never)).rejects.toThrow(
      "Auth account not found",
    );
  });
});
