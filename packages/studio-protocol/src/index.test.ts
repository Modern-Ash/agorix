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
      parseUiMessage({
        schema,
        type: "intent",
        intent: {
          type: "insertBlock",
          blockType: "sound_play",
          to: { container: script, index: 0 },
        },
      }),
    ).toMatchObject({ type: "intent", intent: { blockType: "sound_play" } });
    expect(
      parseUiMessage({ schema, type: "decideProposal", proposalId: "p:1", decision: "rejected" }),
    ).toBeDefined();
    expect(
      parseUiMessage({
        schema,
        type: "updateMissionSpec",
        spec: {
          goal: "Guide the rocket to the beacon.",
          successCheck: "touches-goal",
          predictionPrompt: "Will it touch the beacon?",
        },
      }),
    ).toMatchObject({
      type: "updateMissionSpec",
      spec: { goal: "Guide the rocket to the beacon.", successCheck: "touches-goal" },
    });
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
      {
        schema,
        type: "updateMissionSpec",
        spec: { goal: "x".repeat(141), successCheck: "touches-goal" },
      },
      {
        schema,
        type: "updateMissionSpec",
        spec: { goal: "Move", successCheck: "ask-ai" },
      },
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

  it("parses Workbench execution controls separately from the agent run message", () => {
    expect(parseUiMessage({ schema, type: "executionCommand", command: "run" })).toEqual({
      schema,
      type: "executionCommand",
      command: "run",
    });
    expect(
      parseUiMessage({
        schema,
        type: "updateActor",
        actorId: "actor:main",
        patch: { x: 10, y: 4, direction: 90, visible: true, appearanceId: "asset:costume.default" },
      }),
    ).toMatchObject({
      type: "updateActor",
      patch: { x: 10, costumeId: "asset:costume.default" },
    });
    expect(
      parseUiMessage({
        schema,
        type: "updateActor",
        actorId: "actor:main",
        patch: { size: 0 },
      }),
    ).toBeUndefined();
    expect(parseUiMessage({ schema, type: "executionCommand", command: "pause" })).toBeUndefined();
    expect(
      parseHostMessage({
        schema,
        type: "executionState",
        status: "running",
        outcome: "completed",
        frameIndex: 2,
        frameCount: 8,
        stepsUsed: 7,
      }),
    ).toEqual({
      schema,
      type: "executionState",
      status: "running",
      outcome: "completed",
      frameIndex: 2,
      frameCount: 8,
      stepsUsed: 7,
    });
    expect(
      parseHostMessage({
        schema,
        type: "executionState",
        status: "paused",
        outcome: "completed",
        frameIndex: 0,
        frameCount: 1,
        stepsUsed: 0,
      }),
    ).toBeUndefined();
    expect(
      parseHostMessage({
        schema,
        type: "stageFrame",
        frame: {
          state: {
            sprite: { x: 12, y: 4, heading: 90, radius: 10 },
            goal: { x: 100, y: 0, radius: 12 },
            viewport: { width: 264, height: 192 },
            variables: [{ id: "score", label: "score", value: 4, visible: true }],
            sounds: { activeSoundIds: ["asset:sound.beacon"] },
            actors: [
              {
                id: "actor:main",
                name: "Explorer",
                x: 12,
                y: 4,
                direction: 90,
                size: 100,
                visible: true,
                costumeId: "asset:costume.default",
                scriptCount: 1,
              },
              {
                id: "actor:helper",
                name: "Helper",
                x: 32,
                y: 24,
                direction: 0,
                size: 75,
                visible: false,
                appearanceId: "asset:costume.default",
              },
            ],
          },
          frameIndex: 1,
          frameCount: 8,
          step: 2,
          running: true,
          reachedGoal: false,
          actorId: "actor:main",
          scriptId: "main",
          statementType: "move",
          highlightedNodeId: "scripts[0]/statements[0]",
        },
      }),
    ).toMatchObject({
      type: "stageFrame",
      frame: {
        frameIndex: 1,
        actorId: "actor:main",
        scriptId: "main",
        statementType: "move",
        highlightedNodeId: "scripts[0]/statements[0]",
        state: {
          actors: [
            { id: "actor:main", costumeId: "asset:costume.default", scriptCount: 1 },
            { id: "actor:helper", costumeId: "asset:costume.default" },
          ],
          variables: [{ id: "score", label: "score", value: 4, visible: true }],
          sounds: { activeSoundIds: ["asset:sound.beacon"] },
        },
      },
    });
    expect(
      parseHostMessage({
        schema,
        type: "stageFrame",
        frame: {
          state: {
            sprite: { x: 0, y: 0, heading: Number.NaN, radius: 10 },
            goal: { x: 0, y: 0, radius: 10 },
            viewport: { width: 264, height: 192 },
          },
          frameIndex: 0,
          frameCount: 1,
          step: 0,
          running: false,
          reachedGoal: false,
        },
      }),
    ).toBeUndefined();
    expect(
      parseHostMessage({
        schema,
        type: "actors",
        selectedActorId: "actor:main",
        actors: [
          {
            id: "actor:main",
            name: "Sprite",
            x: 0,
            y: 0,
            direction: 0,
            size: 100,
            visible: true,
            costumeId: "asset:costume.default",
            scriptCount: 1,
          },
        ],
      }),
    ).toMatchObject({
      type: "actors",
      selectedActorId: "actor:main",
      actors: [{ costumeId: "asset:costume.default", scriptCount: 1 }],
    });
    expect(
      parseHostMessage({
        schema,
        type: "actors",
        actors: [
          {
            id: "actor:main",
            name: "Sprite",
            x: 0,
            y: 0,
            direction: 0,
            size: 401,
            visible: true,
          },
        ],
      }),
    ).toBeUndefined();
    expect(
      parseHostMessage({
        schema,
        type: "assets",
        assets: [
          {
            id: "asset:space.explorer",
            name: "Explorer",
            kind: "sprite",
            tags: ["starter", "space"],
            width: 64,
            height: 64,
            preview: "triangle",
          },
        ],
      }),
    ).toMatchObject({ type: "assets", assets: [{ kind: "sprite" }] });
    expect(
      parseHostMessage({
        schema,
        type: "missionSpec",
        spec: {
          goal: "Guide the rocket to the beacon.",
          successCheck: "touches-goal",
          predictionPrompt: "Will it touch the beacon?",
          hash: "mission:abcd1234",
        },
      }),
    ).toMatchObject({
      type: "missionSpec",
      spec: { goal: "Guide the rocket to the beacon.", hash: "mission:abcd1234" },
    });
    expect(
      parseHostMessage({
        schema,
        type: "missionSpec",
        spec: { goal: "Move", successCheck: "touches-goal", hash: "bad hash" },
      }),
    ).toBeUndefined();
    expect(
      parseHostMessage({
        schema,
        type: "stageFrame",
        frame: {
          state: {
            sprite: { x: 0, y: 0, heading: 0, radius: 10 },
            goal: { x: 100, y: 0, radius: 12 },
            viewport: { width: 264, height: 192 },
            backdropId: "asset:space.nebula",
            actors: [
              {
                id: "actor:main",
                name: "Sprite",
                x: 0,
                y: 0,
                direction: 0,
                size: 100,
                visible: true,
                costumeId: "asset:costume.spark",
                bubble: { kind: "say", text: "Go Nova" },
              },
            ],
          },
          frameIndex: 0,
          frameCount: 1,
          step: 0,
          running: true,
          reachedGoal: false,
        },
      }),
    ).toMatchObject({
      type: "stageFrame",
      frame: {
        state: {
          backdropId: "asset:space.nebula",
          actors: [{ costumeId: "asset:costume.spark", bubble: { text: "Go Nova" } }],
        },
      },
    });
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
    expect(
      bad({
        scripts: [
          {
            id: "s",
            trigger: { id: "t", type: "event_on_start" },
            statements: [
              { id: "sound", type: "sound_play", fields: { soundId: "asset:sound.beacon" } },
              { id: "stop", type: "sound_stop" },
            ],
          },
        ],
      }),
    ).toBeDefined();
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
    expect(
      parseHostMessage({
        schema,
        type: "ambientHint",
        hint: {
          label: "Companion can debug this with runtime evidence.",
          blockId: "block:a",
          actions: ["debug", "explain"],
        },
      }),
    ).toEqual({
      schema,
      type: "ambientHint",
      hint: {
        label: "Companion can debug this with runtime evidence.",
        blockId: "block:a",
        actions: ["debug", "explain"],
      },
    });
    expect(parseHostMessage({ schema, type: "ambientHint" })).toEqual({
      schema,
      type: "ambientHint",
    });
    expect(
      parseHostMessage({ schema, type: "ambientHint", hint: { label: "/home/ana", actions: [] } }),
    ).toBeUndefined();
    expect(
      parseHostMessage({
        schema,
        type: "stageFrame",
        frame: {
          state: {
            sprite: { x: 0, y: 0, heading: 0, radius: 10 },
            goal: { x: 0, y: 0, radius: 10 },
            viewport: { width: 264, height: 192 },
            variables: [{ id: "bad space", label: "score", value: 1, visible: true }],
          },
          frameIndex: 0,
          frameCount: 1,
          step: 0,
          running: false,
          reachedGoal: false,
        },
      }),
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

describe("requirePredictionBeforeAccept agreements", () => {
  const base = {
    aiEnabled: true,
    assistanceCeiling: 4,
    mode: "supervised",
    proactive: {
      "runtime-error": true,
      stalled: true,
      "repeated-error": true,
      "repeat-pattern": true,
      "first-step": true,
    },
  };
  it("defaults to false when absent and validates the flag when present", () => {
    expect(parseHostMessage({ schema, type: "agreements", agreements: base })).toMatchObject({
      agreements: { requirePredictionBeforeAccept: false },
    });
    expect(
      parseHostMessage({
        schema,
        type: "agreements",
        agreements: { ...base, requirePredictionBeforeAccept: true },
      }),
    ).toMatchObject({ agreements: { requirePredictionBeforeAccept: true } });
    expect(
      parseHostMessage({
        schema,
        type: "agreements",
        agreements: { ...base, requirePredictionBeforeAccept: "yes" },
      }),
    ).toBeUndefined();
    expect(parseHostMessage({ schema, type: "error", code: "PREDICTION_REQUIRED" })).toBeDefined();
  });
});

describe("advanced proposal messages", () => {
  const evidence = { stepsUsed: 4, reachedGoal: true, outcome: "completed" } as const;
  const operations = [
    {
      index: 0,
      kind: "add",
      label: "Add move 10 steps",
      blockId: "block:a",
      editable: { field: "steps", value: 10 },
    },
  ];
  const base = {
    schema,
    type: "proposal",
    proposalId: "p1",
    purpose: "p",
    rationale: "r",
    changes: [],
  };

  it("keeps old proposal messages valid and parses operations, evidence and alternatives", () => {
    expect(parseHostMessage(base)).toEqual(base);
    const full = {
      ...base,
      operations,
      evidence,
      alternatives: [{ proposalId: "p2", purpose: "q", tradeoff: "t", evidence }],
    };
    expect(parseHostMessage(full)).toEqual(full);
    expect(parseHostMessage({ ...base, operations: [{ index: 0 }] })).toBeUndefined();
    expect(parseHostMessage({ ...base, evidence: { stepsUsed: -1 } })).toBeUndefined();
    expect(parseHostMessage({ ...base, alternatives: "x" })).toBeUndefined();
    const sourced = { ...base, origin: "provider", notice: "Using built-in help." };
    expect(parseHostMessage(sourced)).toEqual(sourced);
    expect(parseHostMessage({ ...base, origin: "other" })).toBeUndefined();
    expect(parseHostMessage({ ...base, notice: "" })).toBeUndefined();
  });

  it("parses proposal scope ids and expected runtime evidence", () => {
    const scoped = {
      ...base,
      affectedActorIds: ["actor:explorer"],
      affectedScriptIds: ["explorer-script"],
      affectedAssetIds: ["asset:costume.explorer"],
      affectedVariableIds: ["score"],
      affectedNodeIds: ["scripts[0]/statements[0]"],
      expectedRuntimeEvidence: [
        {
          id: "move-runs",
          description: "The changed move block appears in the runtime trace.",
          nodeIds: ["scripts[0]/statements[0]"],
          actorIds: ["actor:explorer"],
          scriptIds: ["explorer-script"],
          variableIds: ["score"],
          outcome: "completes",
        },
      ],
    };
    expect(parseHostMessage(scoped)).toEqual(scoped);
    expect(parseHostMessage({ ...base, affectedActorIds: [0] })).toBeUndefined();
    expect(parseHostMessage({ ...base, affectedVariableIds: [0] })).toBeUndefined();
    expect(
      parseHostMessage({
        ...base,
        expectedRuntimeEvidence: [{ id: "e", description: "d", outcome: "maybe" }],
      }),
    ).toBeUndefined();
  });

  it("parses selectionEvidence results", () => {
    const ok = {
      schema,
      type: "selectionEvidence",
      proposalId: "p1",
      result: { ok: true, evidence },
    };
    expect(parseHostMessage(ok)).toEqual(ok);
    const bad = {
      schema,
      type: "selectionEvidence",
      proposalId: "p1",
      result: { ok: false, reason: "EMPTY" },
    };
    expect(parseHostMessage(bad)).toEqual(bad);
    expect(parseHostMessage({ ...bad, result: { ok: false, reason: "nope" } })).toBeUndefined();
  });

  it("parses selections on decideProposal, previewSelection and chooseAlternative", () => {
    const selection = { include: [0, 2], overrides: [{ index: 0, value: 7 }] };
    expect(
      parseUiMessage({
        schema,
        type: "decideProposal",
        proposalId: "p1",
        decision: "modified",
        selection,
      }),
    ).toEqual({
      schema,
      type: "decideProposal",
      proposalId: "p1",
      decision: "modified",
      selection,
    });
    expect(
      parseUiMessage({
        schema,
        type: "decideProposal",
        proposalId: "p1",
        decision: "modified",
        selection: { include: [-1] },
      }),
    ).toBeUndefined();
    expect(
      parseUiMessage({
        schema,
        type: "decideProposal",
        proposalId: "p1",
        decision: "modified",
        selection: { include: [0], overrides: [{ index: 0, value: 1.5 }] },
      }),
    ).toBeUndefined();
    expect(
      parseUiMessage({ schema, type: "previewSelection", proposalId: "p1", selection }),
    ).toEqual({
      schema,
      type: "previewSelection",
      proposalId: "p1",
      selection,
    });
    expect(parseUiMessage({ schema, type: "chooseAlternative", proposalId: "p2" })).toEqual({
      schema,
      type: "chooseAlternative",
      proposalId: "p2",
    });
    expect(
      parseUiMessage({ schema, type: "chooseAlternative", proposalId: "<x>" }),
    ).toBeUndefined();
  });
});

describe("execution event trace messages", () => {
  it("parses executionState event traces defensively", () => {
    const message = {
      schema,
      type: "executionState",
      status: "completed",
      outcome: "completed",
      frameIndex: 1,
      frameCount: 2,
      stepsUsed: 2,
      eventTrace: [
        {
          id: "activation:0",
          step: 1,
          actorId: "actor:main",
          scriptId: "main",
          event: "start",
          reason: "Run started",
        },
      ],
    };

    expect(parseHostMessage(message)).toEqual(message);
    expect(
      parseHostMessage({
        ...message,
        eventTrace: [{ ...message.eventTrace[0], reason: "" }],
      }),
    ).toBeUndefined();
  });
});
