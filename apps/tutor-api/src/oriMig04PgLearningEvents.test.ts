import { describe, expect, it } from "vitest";
import { createOriMig04PgLearningEvents } from "./oriMig04PgLearningEvents.js";

describe("MIG-04 trusted learner event persistence", () => {
  it("increments attempts without trusting client-supplied counts", async () => {
    const calls: unknown[][] = [];
    const write = createOriMig04PgLearningEvents({
      query: async (_sql: string, values: unknown[]) => {
        calls.push(values);
        return { rowCount: 1 } as never;
      },
    } as never);
    expect(await write("owner", "project", { kind: "attempt" })).toBe(true);
    expect(calls).toEqual([["owner", "project", 1, 0, "explore", false]]);
  });

  it("records hints and stages, denying missing ownership", async () => {
    const calls: unknown[][] = [];
    const write = createOriMig04PgLearningEvents({
      query: async (_sql: string, values: unknown[]) => {
        calls.push(values);
        return { rowCount: 0 } as never;
      },
    } as never);
    expect(await write("owner", "other-project", { kind: "hint" })).toBe(false);
    expect(await write("owner", "other-project", { kind: "stage", stage: "connect" })).toBe(false);
    expect(calls).toEqual([
      ["owner", "other-project", 0, 1, "explore", false],
      ["owner", "other-project", 0, 0, "connect", true],
    ]);
  });
});
