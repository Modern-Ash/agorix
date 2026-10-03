import { describe, expect, it } from "vitest";
import { decideProactiveSuggestion, type ProactiveSignal } from "./proactive.js";

const base: ProactiveSignal = {
  kind: "repeat-pattern",
  occurrences: 4,
  running: false,
  declinedForCurrentProgram: false,
  declinedCount: 0,
};

describe("decideProactiveSuggestion", () => {
  it("offers when a clear pattern exists and nothing argues for silence", () => {
    expect(decideProactiveSuggestion(base)).toEqual({
      action: "offer",
      reason: "repeated-steps-detected",
      generativeNeeded: "no",
    });
  });

  it.each([
    ["running", { running: true }, "learner-is-executing"],
    ["weak pattern", { occurrences: 2 }, "pattern-too-weak"],
    ["declined this program", { declinedForCurrentProgram: true }, "learner-declined-this-program"],
    ["declined twice", { declinedCount: 2 }, "learner-repeatedly-declined"],
  ])("stays silent when %s", (_name, patch, reason) => {
    expect(decideProactiveSuggestion({ ...base, ...patch })).toMatchObject({
      action: "silence",
      reason,
      generativeNeeded: "no",
    });
  });

  it("still offers after a single earlier decline", () => {
    expect(decideProactiveSuggestion({ ...base, declinedCount: 1 }).action).toBe("offer");
  });
});
