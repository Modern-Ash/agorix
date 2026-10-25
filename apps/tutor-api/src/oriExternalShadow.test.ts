import { describe, expect, it } from "vitest";
import { dispatchOriExternalShadow, oriExternalShadowEnabled } from "./oriExternalShadow.js";

describe("external Ori shadow boundary", () => {
  it("is disabled unless explicitly true", () => {
    expect(oriExternalShadowEnabled({})).toBe(false);
    expect(oriExternalShadowEnabled({ AGORIX_ORI_EXTERNAL_SHADOW: "false" })).toBe(false);
    expect(oriExternalShadowEnabled({ AGORIX_ORI_EXTERNAL_SHADOW: "true" })).toBe(true);
  });
  it("never invokes callback when disabled", async () => {
    let calls = 0;
    dispatchOriExternalShadow(false, async () => { calls++; }, { missionIndex: 0, hintLevel: 1, scriptCount: 1 });
    await Promise.resolve();
    expect(calls).toBe(0);
  });
  it("passes only minimized metadata and ignores callback failures", async () => {
    const received: unknown[] = [];
    dispatchOriExternalShadow(true, async (input) => {
      received.push(input);
      throw new Error("provider unavailable");
    }, { missionIndex: 1, hintLevel: 2, scriptCount: 3 });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(received).toEqual([{ missionIndex: 1, hintLevel: 2, scriptCount: 3 }]);
  });
});
