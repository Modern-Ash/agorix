import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const handlers = vi.hoisted(() => ({
  selection: [] as Array<(e: unknown) => void>,
  edit: [] as Array<(e: unknown) => void>,
  disposed: 0,
}));

vi.mock("vscode", () => ({
  window: {
    onDidChangeTextEditorSelection: (h: (e: unknown) => void) => {
      handlers.selection.push(h);
      return { dispose: () => handlers.disposed++ };
    },
  },
  workspace: {
    onDidChangeTextDocument: (h: (e: unknown) => void) => {
      handlers.edit.push(h);
      return { dispose: () => handlers.disposed++ };
    },
  },
}));

import type { StudioSignal } from "@agorix/learning-decision-plane";
import { StudioSignalAdapter } from "./studioSignals.js";

const studioDoc = { uri: { fsPath: "/home/kid/p.agorix" }, languageId: "agorix" };
const otherDoc = { uri: { fsPath: "/x/other.txt" }, languageId: "text" };
const select = (doc: unknown, start: number, end: number): void =>
  handlers.selection.forEach((h) =>
    h({
      textEditor: { document: doc },
      selections: [{ start: { line: start }, end: { line: end } }],
    }),
  );
const edit = (doc: unknown): void =>
  handlers.edit.forEach((h) => h({ document: doc, contentChanges: [{}] }));

describe("StudioSignalAdapter", () => {
  let signals: StudioSignal[];
  let adapter: StudioSignalAdapter;
  beforeEach(() => {
    vi.useFakeTimers();
    handlers.selection.length = handlers.edit.length = handlers.disposed = 0;
    signals = [];
    adapter = new StudioSignalAdapter({
      onSignal: (s) => signals.push(s),
      isStudioDocument: (d) => (d as typeof studioDoc).languageId === "agorix",
      nodeIdsForLines: (a, b) => [`n${a}`, `n${b}`],
      selectionDebounceMs: 100,
      stalledAfterMs: 5_000,
      idleAfterMs: 20_000,
    });
  });
  afterEach(() => {
    adapter.dispose();
    vi.useRealTimers();
  });
  const kinds = (): string[] => signals.map((s) => s.kind);

  it("debounces selection into one signal with node ids and no paths", () => {
    select(studioDoc, 1, 1);
    select(studioDoc, 2, 3);
    vi.advanceTimersByTime(99);
    expect(signals).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(kinds()).toEqual(["selection-changed"]);
    expect(signals[0]?.nodeIds).toEqual(["n2", "n3"]);
    expect(signals[0]?.ranges).toEqual([{ startLine: 2, endLine: 3 }]);
    expect(JSON.stringify(signals)).not.toContain("/home");
  });

  it("ignores non-studio documents", () => {
    select(otherDoc, 1, 1);
    edit(otherDoc);
    vi.advanceTimersByTime(1_000);
    expect(signals).toHaveLength(0);
  });

  it("emits runtime success and error, then repeated-error then stalled", () => {
    adapter.runResult({ ok: true });
    adapter.runResult({ ok: false, code: "E_LOOP", nodeId: "n1" });
    adapter.runResult({ ok: false, code: "E_LOOP", nodeId: "n1" });
    expect(kinds()).toEqual([
      "runtime-success",
      "runtime-error",
      "runtime-error",
      "repeated-error",
    ]);
    expect(signals[3]?.occurrences).toBe(2);
    vi.advanceTimersByTime(5_000);
    expect(kinds().at(-1)).toBe("stalled");
    expect(signals.at(-1)?.seconds).toBe(5);
  });

  it("an edit restarts the stall clock; success cancels it", () => {
    adapter.runResult({ ok: false, code: "E1" });
    vi.advanceTimersByTime(4_000);
    edit(studioDoc);
    vi.advanceTimersByTime(4_000);
    expect(kinds()).not.toContain("stalled");
    adapter.runResult({ ok: true });
    vi.advanceTimersByTime(10_000);
    expect(kinds()).not.toContain("stalled");
  });

  it("sanitizes hostile codes coming from the host", () => {
    adapter.runResult({ ok: false, code: "/home/kid/secret.ts: boom" });
    expect(signals[0]?.code).toBeUndefined();
  });

  it("emits idle after inactivity and activity postpones it", () => {
    vi.advanceTimersByTime(19_000);
    edit(studioDoc);
    vi.advanceTimersByTime(19_000);
    expect(kinds()).toEqual([]);
    vi.advanceTimersByTime(1_000);
    expect(kinds()).toEqual(["idle"]);
  });

  it("maps program shape to first-step and repeat-pattern, proposals to decided", () => {
    adapter.programShape({ statementCount: 0, repeatOccurrences: 0 });
    adapter.programShape({ statementCount: 0, repeatOccurrences: 0 });
    adapter.programShape({ statementCount: 5, repeatOccurrences: 2 });
    adapter.programShape({ statementCount: 9, repeatOccurrences: 3 });
    adapter.proposalDecided("p-1", "accepted");
    expect(kinds()).toEqual(["first-step", "repeat-pattern", "proposal-decided"]);
    expect(signals[2]).toMatchObject({ proposalId: "p-1", decision: "accepted" });
  });

  it("increments sequence monotonically", () => {
    adapter.runResult({ ok: true });
    adapter.runResult({ ok: true });
    expect(signals.map((s) => s.sequence)).toEqual([0, 1]);
  });

  it("cancelPending drops debounce and timers; dispose unsubscribes and goes silent", () => {
    select(studioDoc, 1, 1);
    adapter.runResult({ ok: false, code: "E" });
    const before = signals.length;
    adapter.cancelPending();
    vi.advanceTimersByTime(100_000);
    expect(signals).toHaveLength(before);
    adapter.dispose();
    expect(handlers.disposed).toBe(2);
    adapter.runResult({ ok: true });
    select(studioDoc, 1, 1);
    vi.advanceTimersByTime(100_000);
    expect(signals).toHaveLength(before);
  });
});
