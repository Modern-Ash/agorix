import { describe, expect, it } from "vitest";
import { ambientIndicatorView, type AmbientIndicatorState } from "./indicator.js";

describe("ambientIndicatorView", () => {
  it("renders every ambient state with an icon first", () => {
    const states: readonly AmbientIndicatorState[] = [
      "quiet",
      "available",
      "working",
      "off",
      "budget-capped",
    ];

    for (const state of states) {
      expect(ambientIndicatorView({ state }).text).toMatch(/^\$\([^)]+\)/);
    }
  });

  it("makes available offers clickable and explains System-0 or LAYA provenance", () => {
    expect(
      ambientIndicatorView({
        state: "available",
        offer: { reason: "runtime-error-detected", source: "system0" },
      }),
    ).toMatchObject({
      command: "agorixStudio.ambientOffer",
      tooltip: expect.stringContaining("system0"),
    });
  });
});
