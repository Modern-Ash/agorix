import { describe, expect, it } from "vitest";
import { createOriExternalShadowDispatcher } from "./oriExternalShadow.js";

describe("Ori shadow backpressure", () => {
  it("caps concurrent calls and skips excess work without queueing", async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let calls = 0;
    const shadow = async () => { calls++; await gate; };
    const dispatcher = createOriExternalShadowDispatcher(1);
    const input = { missionIndex: 0, hintLevel: 1 as const, scriptCount: 1 };
    dispatcher.dispatch(true, shadow, input);
    dispatcher.dispatch(true, shadow, input);
    await Promise.resolve();
    expect(calls).toBe(1);
    expect(dispatcher.inFlight).toBe(1);
    release?.();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(dispatcher.inFlight).toBe(0);
    dispatcher.dispatch(true, shadow, input);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(calls).toBe(2);
  });

  it("recovers capacity after callback rejection", async () => {
    const dispatcher = createOriExternalShadowDispatcher(1);
    const input = { missionIndex: 0, hintLevel: 1 as const, scriptCount: 1 };
    dispatcher.dispatch(true, async () => { throw new Error("offline"); }, input);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(dispatcher.inFlight).toBe(0);
  });

  it("rejects invalid limits and never calls when disabled", async () => {
    expect(() => createOriExternalShadowDispatcher(0)).toThrow();
    let calls = 0;
    createOriExternalShadowDispatcher().dispatch(false, async () => { calls++; }, {
      missionIndex: 0, hintLevel: 1, scriptCount: 1,
    });
    await Promise.resolve();
    expect(calls).toBe(0);
  });
});
