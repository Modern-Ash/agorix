import { describe, expect, it } from "vitest";
import {
  decideProactiveSuggestion,
  decideProactiveWithLaya,
  EMPTY_PROACTIVE_MEMORY,
  PROACTIVE_MAX_DECLINES,
  PROACTIVE_MIN_REPEATED_ERRORS,
  PROACTIVE_MIN_STALL_SECONDS,
  PROACTIVE_SILENCE_REASONS,
  proactiveSignalFromStudio,
  recordProactiveOutcome,
  type ProactiveMemory,
  type ProactiveSignal,
} from "./proactive.js";
import { createStudioSignal } from "./studio-signals.js";
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

describe("Studio proactive policy", () => {
  const studio: ProactiveSignal = {
    kind: "runtime-error",
    occurrences: 1,
    code: "E_TYPE",
    running: false,
    typing: false,
    aiEnabled: true,
    declinedForCurrentProgram: false,
    declinedCount: 0,
  };
  const stalled: ProactiveSignal = { ...studio, kind: "stalled", code: undefined, seconds: 120 };
  const repeated: ProactiveSignal = { ...studio, kind: "repeated-error", occurrences: 3 };

  it.each([
    ["runtime-error", studio, ["explain", "debug"]],
    ["stalled", stalled, ["propose", "challenge"]],
    ["repeated-error", repeated, ["debug", "explain", "challenge"]],
  ])("offers for %s with actions and no content", (kind, signal, actions) => {
    const d = decideProactiveSuggestion(signal);
    expect(d).toEqual({
      action: "offer",
      reason: `${kind}-detected`,
      generativeNeeded: "no",
      source: "system0",
      actions,
    });
    expect(Object.keys(d).sort()).toEqual([
      "action",
      "actions",
      "generativeNeeded",
      "reason",
      "source",
    ]);
  });

  const silencePaths: [string, Partial<ProactiveSignal>, string][] = [
    ["ai disabled", { aiEnabled: false }, "ai-disabled"],
    ["running", { running: true }, "learner-is-executing"],
    ["typing", { typing: true }, "learner-is-typing"],
    ["program declined", { declinedForCurrentProgram: true }, "learner-declined-this-program"],
    ["recently declined", { sinceLastDecline: 1 }, "recently-declined"],
    ["decline cap", { declinedCount: PROACTIVE_MAX_DECLINES }, "learner-repeatedly-declined"],
    ["ignore decay hits cap", { declinedCount: 1, ignoredCount: 2 }, "learner-repeatedly-declined"],
    ["cooldown", { sinceLastOffer: 1 }, "cooldown-active"],
    ["cooldown grows with ignores", { sinceLastOffer: 4, ignoredCount: 1 }, "cooldown-active"],
  ];
  for (const [kindName, base2] of [
    ["runtime-error", studio],
    ["stalled", stalled],
    ["repeated-error", repeated],
  ] as const) {
    it.each(silencePaths)(`${kindName}: silent when %s`, (_n, patch, reason) => {
      expect(decideProactiveSuggestion({ ...base2, ...patch })).toMatchObject({
        action: "silence",
        reason,
        generativeNeeded: "no",
      });
    });
  }

  it.each([
    ["error without code", { ...studio, code: undefined }],
    ["short stall", { ...stalled, seconds: PROACTIVE_MIN_STALL_SECONDS - 1 }],
    ["stall without seconds", { ...stalled, seconds: undefined }],
    ["single repeated error", { ...repeated, occurrences: PROACTIVE_MIN_REPEATED_ERRORS - 1 }],
  ])("silent when evidence too weak: %s", (_n, signal) => {
    expect(decideProactiveSuggestion(signal)).toMatchObject({
      action: "silence",
      reason: "evidence-too-weak",
    });
  });

  it("offers again once decline window and cooldown pass", () => {
    expect(
      decideProactiveSuggestion({ ...studio, sinceLastDecline: 5, sinceLastOffer: 3 }).action,
    ).toBe("offer");
    expect(
      decideProactiveSuggestion({ ...studio, ignoredCount: 1, sinceLastOffer: 6 }).action,
    ).toBe("offer");
  });

  it("every enumerated silence reason is reachable and every reason has a test", () => {
    const seen = new Set<string>();
    const all: ProactiveSignal[] = [
      { ...studio, aiEnabled: false },
      { ...studio, running: true },
      { ...studio, typing: true },
      { ...studio, declinedForCurrentProgram: true },
      { ...studio, sinceLastDecline: 0 },
      { ...studio, declinedCount: 2 },
      { ...studio, sinceLastOffer: 0 },
      { ...studio, code: undefined },
      { ...base, occurrences: 1 },
      { ...base, kind: "first-step", occurrences: 2 },
    ];
    for (const s of all) seen.add(decideProactiveSuggestion(s).reason);
    expect([...seen].sort()).toEqual([...PROACTIVE_SILENCE_REASONS].sort());
  });

  it("Web signals ignore Studio-only fields' absence (backward compatible)", () => {
    expect(decideProactiveSuggestion(base).actions).toBeUndefined();
  });

  it("property: silence whenever any silence input is set, across kinds", () => {
    for (const s of [studio, stalled, repeated]) {
      for (const running of [false, true])
        for (const typing of [false, true])
          for (const aiEnabled of [false, true])
            for (const declinedForCurrentProgram of [false, true]) {
              const d = decideProactiveSuggestion({
                ...s,
                running,
                typing,
                aiEnabled,
                declinedForCurrentProgram,
              });
              const quiet = running || typing || !aiEnabled || declinedForCurrentProgram;
              expect(d.action).toBe(quiet ? "silence" : "offer");
              expect(d.generativeNeeded).toBe("no");
            }
    }
  });
});

describe("proactive memory", () => {
  const sig = (sequence: number, extra: Record<string, unknown> = {}) =>
    createStudioSignal("runtime-error", sequence, { code: "E_TYPE", ...extra })!;
  const ctx = (memory: ProactiveMemory, programId = "p1") => ({
    programId,
    running: false,
    typing: false,
    aiEnabled: true,
    memory,
  });

  it("tracks per-program and per-session declines", () => {
    let m = recordProactiveOutcome(EMPTY_PROACTIVE_MEMORY, "p1", "declined", 10);
    expect(proactiveSignalFromStudio(sig(50), ctx(m))).toMatchObject({
      declinedForCurrentProgram: true,
      declinedCount: 1,
    });
    expect(proactiveSignalFromStudio(sig(50), ctx(m, "p2"))).toMatchObject({
      declinedForCurrentProgram: false,
      declinedCount: 1,
    });
    m = recordProactiveOutcome(m, "p2", "declined", 20);
    expect(
      decideProactiveSuggestion(proactiveSignalFromStudio(sig(90), ctx(m, "p3"))!).reason,
    ).toBe("learner-repeatedly-declined");
  });

  it("ignored offers decay: longer cooldown, then cap", () => {
    let m = recordProactiveOutcome(EMPTY_PROACTIVE_MEMORY, "p1", "offered", 10);
    expect(
      decideProactiveSuggestion(proactiveSignalFromStudio(sig(12), ctx(m, "p9"))!).reason,
    ).toBe("cooldown-active");
    m = recordProactiveOutcome(m, "p1", "ignored", 11);
    expect(
      decideProactiveSuggestion(proactiveSignalFromStudio(sig(14), ctx(m, "p9"))!).reason,
    ).toBe("cooldown-active");
    m = recordProactiveOutcome(m, "p1", "ignored", 12);
    m = recordProactiveOutcome(m, "p1", "ignored", 13);
    m = recordProactiveOutcome(m, "p1", "ignored", 14);
    expect(
      decideProactiveSuggestion(proactiveSignalFromStudio(sig(99), ctx(m, "p9"))!).reason,
    ).toBe("learner-repeatedly-declined");
    m = recordProactiveOutcome(m, "p1", "accepted", 13);
    expect(m.ignoredInRow).toBe(0);
  });

  it("ignores non-proactive kinds", () => {
    expect(
      proactiveSignalFromStudio(createStudioSignal("idle", 1)!, ctx(EMPTY_PROACTIVE_MEMORY)),
    ).toBeUndefined();
  });

  it("maps stalled seconds and never carries free text", () => {
    const s = proactiveSignalFromStudio(
      createStudioSignal("stalled", 3, { seconds: 90, code: "x y z" })!,
      ctx(EMPTY_PROACTIVE_MEMORY),
    )!;
    expect(s.seconds).toBe(90);
    expect(s.code).toBeUndefined();
  });
});
