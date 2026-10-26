import { describe, expect, it } from "vitest";
import {
  ORI_EXPRESSIONS,
  expressionForMotion,
  outcomeOfOffer,
  outcomeOfRun,
} from "./kidsOriExpression.js";

// Issue #600: Ori's face comes from things that really happened.
describe("Ori expressions", () => {
  it("shows work in flight, a waiting idea and nothing invented when idle", () => {
    expect(expressionForMotion("thinking", undefined)).toBe("thinking");
    expect(expressionForMotion("proposal", undefined)).toBe("curious");
    expect(expressionForMotion("listening", undefined)).toBe("curious");
    expect(expressionForMotion("idle", "win")).toBe("neutral");
    expect(expressionForMotion("fallback", "good")).toBe("neutral");
  });

  it("reflects how the last run ended, and stays neutral without one", () => {
    expect(expressionForMotion("observing", outcomeOfRun("completed"))).toBe("happy");
    expect(expressionForMotion("observing", outcomeOfRun("budget-exceeded"))).toBe("encourage");
    expect(expressionForMotion("observing", outcomeOfRun(undefined))).toBe("neutral");
    expect(expressionForMotion("observing", outcomeOfOffer("done"))).toBe("celebrate");
    expect(expressionForMotion("observing", outcomeOfOffer("wall"))).toBe("encourage");
    expect(expressionForMotion("observing", outcomeOfOffer("passed"))).toBe("happy");
    expect(expressionForMotion("observing", outcomeOfOffer("move"))).toBe("neutral");
  });

  it("never shows a sad face: a run that needs another try is encouraged", () => {
    expect(ORI_EXPRESSIONS).not.toContain("sad");
    for (const motion of [
      "idle",
      "thinking",
      "proposal",
      "observing",
      "fallback",
      "listening",
    ] as const)
      for (const outcome of [undefined, "good", "retry", "win"] as const)
        expect(ORI_EXPRESSIONS).toContain(expressionForMotion(motion, outcome));
  });
});
