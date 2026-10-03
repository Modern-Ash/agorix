import { describe, expect, it } from "vitest";
import {
  decideProactiveSuggestion,
  decideProactiveWithLaya,
  type ProactiveSignal,
} from "./proactive.js";
import type { LayaBatchTransport } from "./laya.js";

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
      source: "system0",
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

describe("first-step signal", () => {
  const first: ProactiveSignal = { ...base, kind: "first-step", occurrences: 0 };

  it("offers help on an empty program", () => {
    expect(decideProactiveSuggestion(first)).toMatchObject({
      action: "offer",
      reason: "empty-program",
    });
  });

  it("stays silent once the learner started or declined", () => {
    expect(decideProactiveSuggestion({ ...first, occurrences: 1 }).reason).toBe(
      "learner-already-started",
    );
    expect(decideProactiveSuggestion({ ...first, declinedForCurrentProgram: true }).action).toBe(
      "silence",
    );
  });
});

describe("decideProactiveWithLaya", () => {
  const answering = (value: string, confidence: number): LayaBatchTransport => ({
    decideMany: async () => [{ id: "proactiveAction", value, confidence }],
  });

  it("falls back to System-0 without a transport", async () => {
    expect((await decideProactiveWithLaya(base, undefined)).source).toBe("system0");
  });

  it("lets Laya veto an offer with high confidence", async () => {
    expect(await decideProactiveWithLaya(base, answering("silence", 0.95))).toMatchObject({
      action: "silence",
      reason: "laya-judged-not-now",
      source: "laya",
    });
  });

  it("ignores a low-confidence veto", async () => {
    expect((await decideProactiveWithLaya(base, answering("silence", 0.5))).action).toBe("offer");
  });

  it("never lets Laya create an offer System-0 refused", async () => {
    let called = false;
    const transport: LayaBatchTransport = {
      decideMany: async () => {
        called = true;
        return [{ id: "proactiveAction", value: "offer", confidence: 1 }];
      },
    };
    const result = await decideProactiveWithLaya({ ...base, running: true }, transport);
    expect(result.action).toBe("silence");
    expect(called).toBe(false);
  });

  it("falls back to System-0 when Laya fails", async () => {
    const failing: LayaBatchTransport = {
      decideMany: async () => {
        throw new Error("down");
      },
    };
    expect((await decideProactiveWithLaya(base, failing)).action).toBe("offer");
  });
});
