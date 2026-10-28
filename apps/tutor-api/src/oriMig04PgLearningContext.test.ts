import { describe, expect, it } from "vitest";
import { createOriMig04PgLearningContext } from "./oriMig04PgLearningContext.js";

describe("MIG-04 durable pedagogical context", () => {
  it("reads only owner-scoped persisted evidence", async () => {
    const calls: unknown[][] = [];
    const read = createOriMig04PgLearningContext({
      query: async (_sql: string, values: unknown[]) => {
        calls.push(values);
        return { rows: [{ attempts: 2, hints_used: 1, learning_stage: "connect" }] } as never;
      },
    } as never);
    expect(await read("owner", "project")).toEqual({
      attempts: 2,
      hintsUsed: 1,
      learningStage: "connect",
    });
    expect(calls).toEqual([["owner", "project"]]);
  });

  it("fails closed for missing or invalid evidence", async () => {
    for (const rows of [
      [],
      [{ attempts: -1, hints_used: 1, learning_stage: "connect" }],
      [{ attempts: 1, hints_used: 101, learning_stage: "connect" }],
      [{ attempts: 1, hints_used: 1, learning_stage: "unknown" }],
    ]) {
      const read = createOriMig04PgLearningContext({
        query: async () => ({ rows }) as never,
      } as never);
      expect(await read("owner", "project")).toBeNull();
    }
  });
});
