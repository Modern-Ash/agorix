import { describe, expect, it } from "vitest";
import { createStarterWorkspace } from "@agorix/block-editor";
import { DEFAULT_AGREEMENTS, createWorkflow } from "@agorix/agent-workflow";
import { STUDIO_PROTOCOL_VERSION as schema, parseHostMessage, parseUiMessage } from "./index.js";

const script = { kind: "script", scriptIndex: 0 } as const;

describe("studio-protocol", () => {
  it("round-trips well-formed ui messages", () => {
    const intent = {
      type: "moveBlock",
      from: { container: script, index: 0 },
      to: { container: script, index: 1 },
    };
    expect(parseUiMessage({ schema, type: "intent", intent })).toEqual({
      schema,
      type: "intent",
      intent,
    });
    expect(
      parseUiMessage({ schema, type: "agreementsChanged", agreements: DEFAULT_AGREEMENTS }),
    ).toEqual({
      schema,
      type: "agreementsChanged",
      agreements: DEFAULT_AGREEMENTS,
    });
    expect(
      parseUiMessage({ schema, type: "decideProposal", proposalId: "p:1", decision: "rejected" }),
    ).toBeDefined();
  });

  it("rejects junk, unknown types, accept-style intents and bad ids", () => {
    for (const junk of [
      null,
      7,
      {},
      { schema: "x", type: "ready" },
      { schema, type: "mutateProgram" },
      { schema, type: "intent", intent: { type: "acceptProposal", proposalId: "p" } },
      { schema, type: "intent", intent: { type: "reviewProposal", proposalId: "/etc/passwd" } },
      { schema, type: "decideProposal", proposalId: "p", decision: "applied" },
    ]) {
      expect(parseUiMessage(junk)).toBeUndefined();
    }
  });

  it("drops extra keys including __proto__", () => {
    const raw = JSON.parse(
      '{"schema":"agorix/studio-protocol/v1","type":"ready","__proto__":{"x":1},"extra":1}',
    );
    expect(parseUiMessage(raw)).toEqual({ schema, type: "ready" });
  });

  it("parses host messages strictly", () => {
    const state = createWorkflow("supervised");
    expect(parseHostMessage({ schema, type: "workflow", state })).toEqual({
      schema,
      type: "workflow",
      state,
    });
    expect(
      parseHostMessage({ schema, type: "workflow", state: { stage: "nope" } }),
    ).toBeUndefined();
    expect(parseHostMessage({ schema, type: "programHash", hash: "has space" })).toBeUndefined();
  });

  it("validates workspace and error host messages", () => {
    const workspace = createStarterWorkspace();
    expect(
      parseHostMessage({ schema, type: "workspace", workspace, programHash: "abc123" }),
    ).toEqual({
      schema,
      type: "workspace",
      workspace,
      programHash: "abc123",
    });
    const bad = (w: unknown, h = "abc") =>
      parseHostMessage({ schema, type: "workspace", workspace: w, programHash: h });
    expect(
      bad({ scripts: [{ id: "s", trigger: { id: "t", type: "nope" }, statements: [] }] }),
    ).toBeUndefined();
    expect(
      bad({ scripts: Array.from({ length: 65 }, () => workspace.scripts[0]) }),
    ).toBeUndefined();
    expect(bad(workspace, "has space")).toBeUndefined();
    let nested: unknown = [];
    for (let i = 0; i < 20; i += 1) {
      nested = [{ id: `r${i}`, type: "control_repeat", inputs: { body: nested } }];
    }
    expect(
      bad({
        scripts: [{ id: "s", trigger: { id: "t", type: "event_on_start" }, statements: nested }],
      }),
    ).toBeUndefined();
    expect(
      bad({
        scripts: [
          {
            id: "s",
            trigger: { id: "t", type: "event_on_start" },
            statements: [{ id: "m", type: "motion_move", fields: { steps: {} } }],
          },
        ],
      }),
    ).toBeUndefined();
    expect(parseHostMessage({ schema, type: "error", code: "INVALID_CHANGE" })).toBeDefined();
    expect(parseHostMessage({ schema, type: "error", code: "x" })).toBeUndefined();
    expect(
      parseHostMessage({ schema, type: "error", code: "INVALID_CHANGE", reason: "BAD_INDEX" }),
    ).toEqual({ schema, type: "error", code: "INVALID_CHANGE", reason: "BAD_INDEX" });
    expect(
      parseHostMessage({ schema, type: "error", code: "INVALID_CHANGE", reason: "nope" }),
    ).toBeUndefined();
    expect(
      parseHostMessage({ schema, type: "error", code: "INVALID_PROGRAM", reason: "BAD_INDEX" }),
    ).toBeUndefined();
  });

  it("round-trips and bounds the agent loop messages", () => {
    const ok = [
      { schema, type: "stateIntent", text: "make it move" },
      { schema, type: "acceptPlan" },
      { schema, type: "requestProposal" },
      { schema, type: "predict", answer: "yes" },
      { schema, type: "skipPrediction" },
      { schema, type: "run" },
      { schema, type: "continue" },
      { schema, type: "explain", concept: "sequence" },
      { schema, type: "skipExplain" },
    ];
    for (const message of ok) {
      expect(parseUiMessage(message)).toEqual(message);
    }
    for (const bad of [
      { schema, type: "stateIntent", text: "" },
      { schema, type: "stateIntent", text: "a".repeat(141) },
      { schema, type: "stateIntent", text: 4 },
      { schema, type: "predict", answer: "maybe" },
      { schema, type: "explain", concept: "magic" },
    ]) {
      expect(parseUiMessage(bad)).toBeUndefined();
    }
    const hostOk = [
      {
        schema,
        type: "plan",
        tasks: [{ id: "first-step", title: "Try one visible movement step" }],
      },
      {
        schema,
        type: "proposal",
        proposalId: "first-step",
        purpose: "p",
        rationale: "r",
        changes: [
          { kind: "added", afterText: "move(10)" },
          { kind: "changed", blockId: "block:a" },
        ],
      },
      { schema, type: "proposalCleared" },
      { schema, type: "prediction", questionId: "reaches-goal", options: ["yes", "no"] },
      {
        schema,
        type: "comparison",
        predicted: "skipped",
        reachedGoal: false,
        result: "skipped",
        stepsUsed: 3,
      },
      { schema, type: "explainPrompt", options: ["sequence", "repetition"] },
      { schema, type: "explainFeedback", result: "other" },
      { schema, type: "agreements", agreements: DEFAULT_AGREEMENTS },
      { schema, type: "error", code: "STALE_PROPOSAL" },
    ];
    for (const message of hostOk) {
      expect(parseHostMessage(message)).toEqual(message);
    }
    const proposal = {
      schema,
      type: "proposal",
      proposalId: "p",
      purpose: "p",
      rationale: "r",
      changes: [],
    };
    for (const bad of [
      { ...proposal, changes: Array.from({ length: 51 }, () => ({ kind: "added" })) },
      { ...proposal, purpose: "x".repeat(301) },
      { ...proposal, proposalId: "/etc/passwd" },
      { schema, type: "plan", tasks: [{ id: "nope", title: "t" }] },
      {
        schema,
        type: "comparison",
        predicted: "yes",
        reachedGoal: true,
        result: "matched",
        stepsUsed: -1,
      },
      { schema, type: "prediction", questionId: "reaches-goal", options: [] },
    ]) {
      expect(parseHostMessage(bad)).toBeUndefined();
    }
    expect(parseHostMessage({ ...proposal, extra: 1 })).not.toHaveProperty("extra");
  });
});

describe("sync host message", () => {
  it("parses a sync message with optional block ids", () => {
    expect(
      parseHostMessage({
        schema,
        type: "sync",
        selectedBlockId: "block:a",
        failedBlockId: "block:b",
      }),
    ).toEqual({ schema, type: "sync", selectedBlockId: "block:a", failedBlockId: "block:b" });
    expect(parseHostMessage({ schema, type: "sync" })).toEqual({ schema, type: "sync" });
  });

  it("rejects unsafe ids", () => {
    expect(parseHostMessage({ schema, type: "sync", selectedBlockId: "<script>" })).toBeUndefined();
    expect(parseHostMessage({ schema, type: "sync", executingBlockId: 5 })).toBeUndefined();
  });
});

describe("intent baseHash", () => {
  const intent = { type: "revealNode", nodeId: "n1" };
  it("accepts an optional well-formed baseHash", () => {
    expect(parseUiMessage({ schema, type: "intent", intent })).toEqual({
      schema,
      type: "intent",
      intent,
    });
    expect(parseUiMessage({ schema, type: "intent", intent, baseHash: "sha:abc" })).toEqual({
      schema,
      type: "intent",
      intent,
      baseHash: "sha:abc",
    });
    expect(parseUiMessage({ schema, type: "intent", intent, baseHash: "<x>" })).toBeUndefined();
    expect(parseHostMessage({ schema, type: "error", code: "STALE_EDIT" })).toBeDefined();
  });
});

describe("clarification messages", () => {
  const options = [
    { id: "first-step", title: "Try one visible movement step" },
    { id: "repeat-pattern", title: "Write the repeated steps once with repeat" },
  ];
  it("round-trips clarify and answerClarification and rejects bad input", () => {
    expect(parseHostMessage({ schema, type: "clarify", options })).toEqual({
      schema,
      type: "clarify",
      options,
    });
    expect(parseHostMessage({ schema, type: "clarify", options: [options[0]] })).toBeUndefined();
    expect(
      parseHostMessage({ schema, type: "clarify", options: [options[0], { id: "x", title: "t" }] }),
    ).toBeUndefined();
    expect(parseUiMessage({ schema, type: "answerClarification", taskId: "first-step" })).toEqual({
      schema,
      type: "answerClarification",
      taskId: "first-step",
    });
    expect(
      parseUiMessage({ schema, type: "answerClarification", taskId: "free text" }),
    ).toBeUndefined();
    expect(parseHostMessage({ schema, type: "error", code: "STALE_PLAN" })).toBeDefined();
  });
});
