import { describe, expect, it } from "vitest";
import {
  STUDIO_CONTEXT_LIMITS,
  STUDIO_SIGNAL_KINDS,
  STUDIO_SIGNAL_LIMITS,
  STUDIO_SIGNAL_SCHEMA_VERSION,
  buildStudioContext,
  createStudioSignal,
  sanitizeLearnerText,
} from "./index.js";

describe("studio signals", () => {
  it("covers every kind, versioned and JSON round-trippable", () => {
    expect(STUDIO_SIGNAL_KINDS).toHaveLength(9);
    for (const [i, kind] of STUDIO_SIGNAL_KINDS.entries()) {
      const signal = createStudioSignal(kind, i, { nodeIds: ["n1"], seconds: 30 });
      expect(signal?.schema).toBe(STUDIO_SIGNAL_SCHEMA_VERSION);
      expect(JSON.parse(JSON.stringify(signal))).toEqual(signal);
    }
  });

  it("rejects unknown kinds", () => {
    expect(createStudioSignal("chat-message", 1)).toBeUndefined();
  });

  it("drops unknown fields and non-token strings (paths, emails, free text)", () => {
    const signal = createStudioSignal("runtime-error", 1, {
      nodeIds: [
        "node_1",
        "/home/kid/proj/a.agorix",
        "C:\\Users\\kid\\a",
        "kid@example.com",
        "has space",
      ],
      code: "/etc/passwd",
      proposalId: "my name is Ana",
      email: "kid@example.com",
      accountId: "acct-1",
      message: "free text",
    });
    const json = JSON.stringify(signal);
    expect(signal?.nodeIds).toEqual(["node_1"]);
    expect(signal?.code).toBeUndefined();
    for (const leak of ["/home", "C:", "@", "acct", "free text", "Ana", "email", "message"]) {
      expect(json).not.toContain(leak);
    }
  });

  it("clamps numbers and caps id counts", () => {
    const ids = Array.from({ length: 100 }, (_, i) => `n${i}`);
    const signal = createStudioSignal("stalled", 1, {
      nodeIds: ids,
      seconds: 1e12,
      occurrences: -5,
    });
    expect(signal?.nodeIds).toHaveLength(STUDIO_SIGNAL_LIMITS.maxIds);
    expect(signal?.seconds).toBe(STUDIO_SIGNAL_LIMITS.maxSeconds);
    expect(signal?.occurrences).toBe(0);
  });
});

describe("studio context builder", () => {
  const base = {
    missionId: "mission-1",
    missionVersion: 2,
    learningTarget: "loops",
    programHash: "abc123",
    locale: "es-CL",
    scaffoldHistory: [0, 1, 2, 9, "x"],
    snapshotNodes: [{ id: "n1", kind: "move", label: "Ana's secret", path: "/home/u/x" }],
    selectedNodeIds: ["n1"],
    selectedRanges: [{ startLine: 5, endLine: 2 }],
    observations: [{ kind: "error", code: "E_LOOP", nodeId: "n1", message: "at /home/u/x.ts" }],
  };

  it("is deterministic", () => {
    expect(buildStudioContext(base)).toEqual(buildStudioContext(structuredClone(base)));
  });

  it("copies only whitelisted fields", () => {
    const ctx = buildStudioContext({
      ...base,
      userName: "Ana",
      email: "ana@example.com",
      accountId: "acct-9",
      sessionId: "s-1",
      filePath: "/home/faguero/proj/a.agorix",
    });
    const json = JSON.stringify(ctx);
    for (const leak of ["Ana", "ana@", "acct-9", "s-1", "/home", "secret", "message", "path"]) {
      expect(json).not.toContain(leak);
    }
    expect(ctx.scaffoldHistory).toEqual([0, 1, 2]);
    expect(ctx.selection.ranges).toEqual([{ startLine: 2, endLine: 5 }]);
    expect(ctx.snapshot.nodes).toEqual([{ id: "n1", kind: "move" }]);
    expect(ctx.locale).toBe("es-CL");
  });

  it("rejects path-like mission ids and bad locales", () => {
    const ctx = buildStudioContext({
      missionId: "../../etc",
      locale: "/tmp/x",
      learningTarget: "a b",
    });
    expect(ctx.mission).toEqual({});
    expect(ctx.locale).toBeUndefined();
  });

  it("omits learner text unless explicitly submitted, and redacts it when present", () => {
    expect(buildStudioContext(base).learnerText).toBeUndefined();
    const text = sanitizeLearnerText(
      "make it loop, see /home/ana/proj/a.ts or C:\\Users\\ana\\a.ts mail ana@example.com https://x.io/y?token=1 " +
        "sk_" +
        "a".repeat(40),
    );
    expect(text).toContain("make it loop");
    for (const leak of ["/home", "C:\\", "ana@", "https", "aaaaaaaa"]) {
      expect(text).not.toContain(leak);
    }
    expect(sanitizeLearnerText("go ".repeat(500))).toHaveLength(
      STUDIO_CONTEXT_LIMITS.maxLearnerText,
    );
    expect(sanitizeLearnerText(42)).toBeUndefined();
  });

  it("enforces hard size caps", () => {
    const ctx = buildStudioContext({
      ...base,
      snapshotNodes: Array.from({ length: 5000 }, (_, i) => ({ id: `node${i}`, kind: "block" })),
      observations: Array.from({ length: 500 }, () => ({ kind: "error", code: "E" })),
      scaffoldHistory: Array.from({ length: 500 }, () => 1),
      selectedNodeIds: Array.from({ length: 500 }, (_, i) => `n${i}`),
      learnerSubmittedText: "y".repeat(10_000),
    });
    expect(ctx.snapshot.nodes.length).toBeLessThanOrEqual(STUDIO_CONTEXT_LIMITS.maxSnapshotNodes);
    expect(ctx.snapshot.truncated).toBe(true);
    expect(ctx.observations.length).toBe(STUDIO_CONTEXT_LIMITS.maxObservations);
    expect(ctx.scaffoldHistory.length).toBe(STUDIO_CONTEXT_LIMITS.maxScaffoldHistory);
    expect(ctx.selection.nodeIds.length).toBe(STUDIO_CONTEXT_LIMITS.maxSelected);
    expect(JSON.stringify(ctx).length).toBeLessThanOrEqual(
      STUDIO_CONTEXT_LIMITS.maxSerializedBytes,
    );
  });

  it("handles garbage input", () => {
    const ctx = buildStudioContext({ snapshotNodes: "no", observations: 3, scaffoldHistory: {} });
    expect(ctx.snapshot.nodes).toEqual([]);
    expect(ctx.observations).toEqual([]);
  });
});
