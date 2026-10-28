import { describe, expect, it } from "vitest";
import { createOriMig04CommitFence } from "./oriMig04CommitFence.js";

const pilot = {
  mode: "pilot" as const,
  humanAuthorized: true,
  killSwitch: false,
  approvedProjectIds: ["pilot"],
};
describe("MIG-04 serialized commit fence and rollback", () => {
  it("blocks stale generation and unauthorized projects", async () => {
    const fence = createOriMig04CommitFence();
    expect(await fence.replaceFromHost(pilot)).toBe(true);
    const version = fence.snapshot("pilot").generation;
    let writes = 0;
    expect(
      (
        await fence.commit("other", version, async () => {
          writes++;
        })
      ).applied,
    ).toBe(false);
    await fence.emergencyDisable();
    expect(
      (
        await fence.commit("pilot", version, async () => {
          writes++;
        })
      ).applied,
    ).toBe(false);
    expect(writes).toBe(0);
  });
  it("waits for in-flight commit before acknowledging kill switch", async () => {
    const fence = createOriMig04CommitFence();
    await fence.replaceFromHost(pilot);
    const version = fence.snapshot("pilot").generation;
    let release!: () => void;
    let started!: () => void;
    const entered = new Promise<void>((resolve) => {
      started = resolve;
    });
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    const events: string[] = [];
    const commit = fence.commit("pilot", version, async () => {
      events.push("commit-start");
      started();
      await blocked;
      events.push("commit-end");
    });
    await entered;
    const disable = fence.emergencyDisable().then(() => {
      events.push("disabled");
    });
    await Promise.resolve();
    expect(events).toEqual(["commit-start"]);
    release();
    expect((await commit).applied).toBe(true);
    await disable;
    expect(events).toEqual(["commit-start", "commit-end", "disabled"]);
    expect(fence.decide("pilot").learnerVisible).toBe(false);
    expect(
      (
        await fence.commit("pilot", version, async () => {
          throw Error("must not write");
        })
      ).applied,
    ).toBe(false);
  });
});
