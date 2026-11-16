import { describe, expect, it } from "vitest";
import { createStarterWorkspace } from "@agorix/block-editor";
import { DEFAULT_AGREEMENTS, createWorkflow } from "@agorix/agent-workflow";
import { STUDIO_PROTOCOL_VERSION as schema, parseHostMessage, parseUiMessage } from "./index.js";

const script = { kind: "script", scriptIndex: 0 } as const;

describe("studio-protocol", () => {
  it("validates scene selection messages and rejects forged backdrop ids", () => {
    expect(
      parseUiMessage({ schema, type: "updateStage", backdropId: "backdrop:moon" }),
    ).toMatchObject({ type: "updateStage", backdropId: "backdrop:moon" });
    expect(
      parseUiMessage({ schema, type: "updateStage", backdropId: "https://example.com/a" }),
    ).toBeUndefined();
    expect(parseHostMessage({ schema, type: "scene", backdropId: "backdrop:moon" })).toMatchObject({
      type: "scene",
      backdropId: "backdrop:moon",
    });
    expect(parseHostMessage({ schema, type: "scene", backdropId: "../bad" })).toBeUndefined();
  });
  it("accepts only bounded local image sources in asset messages", () => {
    const asset = {
      id: "costume:nova",
      name: "Nova",
      kind: "costume",
      tags: [],
      source: "builtin:kids-gallery-costume:nova",
    };
    expect(parseHostMessage({ schema, type: "assets", assets: [asset] })).toMatchObject({
      assets: [asset],
    });
    expect(
      parseHostMessage({
        schema,
        type: "assets",
        assets: [{ ...asset, source: "https://example.com/x.png" }],
      }),
    ).toBeUndefined();
    expect(
      parseHostMessage({
        schema,
        type: "assets",
        assets: [{ ...asset, source: "data:image/svg+xml,<script/>" }],
      }),
    ).toBeUndefined();
  });
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

  it("accepts finite numeric field edits and rejects malformed values", () => {
    const location = { container: script, index: 0 };
    const valid = {
      schema,
      type: "intent",
      intent: { type: "setNumericField", location, field: "steps", value: 12 },
    };
    expect(parseUiMessage(valid)).toMatchObject(valid);
    for (const value of ["12", Infinity, NaN]) {
      expect(
        parseUiMessage({ schema, type: "intent", intent: { ...valid.intent, value } }),
      ).toBeUndefined();
    }
    expect(
      parseUiMessage({ schema, type: "intent", intent: { ...valid.intent, field: "__proto__" } }),
    ).toBeUndefined();
  });

  it("validates text edits without accepting oversized or forged field names", () => {
    const location = { container: script, index: 0 };
    const intent = { type: "setTextField", location, field: "text", value: "Hola" };
    expect(parseUiMessage({ schema, type: "intent", intent })).toMatchObject({ intent });
    expect(
      parseUiMessage({ schema, type: "intent", intent: { ...intent, value: "x".repeat(161) } }),
    ).toBeUndefined();
    expect(
      parseUiMessage({ schema, type: "intent", intent: { ...intent, field: "__proto__" } }),
    ).toBeUndefined();
  });

  it("allows only bounded boolean reporter choices for visual conditions", () => {
    const location = { container: script, index: 0 };
    const intent = { type: "replaceCondition", location, blockType: "sensing_touching_stage_edge" };
    expect(parseUiMessage({ schema, type: "intent", intent })).toMatchObject({ intent });
    expect(
      parseUiMessage({ schema, type: "intent", intent: { ...intent, blockType: "operator_add" } }),
    ).toBeUndefined();
    expect(
      parseUiMessage({
        schema,
        type: "intent",
        intent: { ...intent, location: { container: script, index: -1 } },
      }),
    ).toBeUndefined();
  });

  it("validates numeric comparison edits and preserves nested operands in snapshots", () => {
    const location = { container: script, index: 0 };
    const intent = { type: "setConditionNumber", location, side: "right", value: 24 };
    expect(parseUiMessage({ schema, type: "intent", intent })).toMatchObject({ intent });
    expect(
      parseUiMessage({ schema, type: "intent", intent: { ...intent, side: "middle" } }),
    ).toBeUndefined();
    expect(
      parseUiMessage({ schema, type: "intent", intent: { ...intent, value: Infinity } }),
    ).toBeUndefined();
    const workspace = {
      scripts: [
        {
          id: "main",
          trigger: { id: "start", type: "event_on_start" },
          statements: [
            {
              id: "if:1",
              type: "control_if",
              inputs: {
                then: [],
                condition: {
                  id: "cmp:1",
                  type: "operator_less_than",
                  inputs: {
                    left: { id: "n:1", type: "literal_number", fields: { value: 0 } },
                    right: { id: "n:2", type: "literal_number", fields: { value: 24 } },
                  },
                },
              },
            },
          ],
        },
      ],
    };
    const message = { schema, type: "workspace", workspace, programHash: "fnv1a32:test" };
    expect(parseHostMessage(message)).toMatchObject({ workspace });
  });

  it("validates variable intents and preserves declarations and value inputs", () => {
    const location = { container: script, index: 0 };
    expect(
      parseUiMessage({ schema, type: "intent", intent: { type: "addVariable", name: "energy" } }),
    ).toMatchObject({ intent: { type: "addVariable", name: "energy" } });
    expect(
      parseUiMessage({ schema, type: "intent", intent: { type: "addVariable", name: " " } }),
    ).toBeUndefined();
    const intent = { type: "setExpressionNumber", location, input: "value", value: 12 };
    expect(parseUiMessage({ schema, type: "intent", intent })).toMatchObject({ intent });
    expect(
      parseUiMessage({ schema, type: "intent", intent: { ...intent, input: "unknown" } }),
    ).toBeUndefined();
    expect(
      parseUiMessage({ schema, type: "intent", intent: { ...intent, value: Infinity } }),
    ).toBeUndefined();
    const workspace = {
      variables: [{ id: "energy", name: "Energy", initialValue: 0, visible: true }],
      scripts: [
        {
          id: "main",
          trigger: { id: "start", type: "event_on_start" },
          statements: [
            {
              id: "set",
              type: "variables_set",
              fields: { variableId: "energy" },
              inputs: { value: { id: "num", type: "literal_number", fields: { value: 12 } } },
            },
          ],
        },
      ],
    };
    expect(
      parseHostMessage({ schema, type: "workspace", workspace, programHash: "fnv1a32:variable" }),
    ).toMatchObject({ workspace });
  });

  it("validates list declarations and bounded workspace projection", () => {
    expect(
      parseUiMessage({ schema, type: "intent", intent: { type: "addList", name: "items" } }),
    ).toMatchObject({ intent: { type: "addList", name: "items" } });
    expect(
      parseUiMessage({ schema, type: "intent", intent: { type: "addList", name: " " } }),
    ).toBeUndefined();
    expect(
      parseUiMessage({
        schema,
        type: "intent",
        intent: {
          type: "setExpressionNumber",
          location: { container: script, index: 0 },
          input: "index",
          value: 2,
        },
      }),
    ).toMatchObject({ intent: { input: "index", value: 2 } });
    const workspace = {
      lists: [{ id: "l", name: "items", initialItems: [1, 2], visible: true }],
      scripts: [{ id: "main", trigger: { id: "start", type: "event_on_start" }, statements: [] }],
    };
    expect(
      parseHostMessage({ schema, type: "workspace", workspace, programHash: "fnv1a32:1" }),
    ).toMatchObject({ workspace });
    expect(
      parseHostMessage({
        schema,
        type: "workspace",
        workspace: { ...workspace, lists: [{ ...workspace.lists[0], initialItems: [Infinity] }] },
        programHash: "fnv1a32:1",
      }),
    ).toBeUndefined();
  });
  it("accepts only structured numeric reporter edits", () => {
    const location = { container: script, index: 0 };
    const intent = {
      type: "setNumericInput",
      location,
      input: "value",
      reporter: "listItem",
      referenceId: "list:items",
      itemIndex: 2,
    };
    expect(parseUiMessage({ schema, type: "intent", intent })).toMatchObject({ intent });
    expect(
      parseUiMessage({ schema, type: "intent", intent: { ...intent, referenceId: "https://bad" } }),
    ).toBeUndefined();
    expect(
      parseUiMessage({ schema, type: "intent", intent: { ...intent, itemIndex: Infinity } }),
    ).toBeUndefined();
    expect(
      parseUiMessage({ schema, type: "intent", intent: { ...intent, reporter: "number" } }),
    ).toBeUndefined();
  });

  it("validates actor creation and script ownership in snapshots", () => {
    expect(parseUiMessage({ schema, type: "createActor", name: "Robot" })).toEqual({
      schema,
      type: "createActor",
      name: "Robot",
    });
    expect(parseUiMessage({ schema, type: "createActor", name: " " })).toBeUndefined();
    expect(parseUiMessage({ schema, type: "createActor", name: "x".repeat(81) })).toBeUndefined();
    const actor = {
      id: "actor:robot",
      name: "Robot",
      x: 0,
      y: 0,
      direction: 0,
      size: 100,
      visible: true,
      scriptCount: 1,
      scriptIds: ["script:robot"],
    };
    expect(
      parseHostMessage({ schema, type: "actors", actors: [actor], selectedActorId: actor.id }),
    ).toMatchObject({ actors: [actor] });
    expect(
      parseHostMessage({
        schema,
        type: "actors",
        actors: [{ ...actor, scriptIds: ["https://bad"] }],
        selectedActorId: actor.id,
      }),
    ).toBeUndefined();
  });

  it("validates actor script creation and message triggers", () => {
    const baseHash = "fnv1a32:abcdef01";
    expect(
      parseUiMessage({
        schema,
        type: "createScript",
        actorId: "actor:robot",
        trigger: "onMessage",
        message: " go ",
        baseHash,
      }),
    ).toEqual({
      schema,
      type: "createScript",
      actorId: "actor:robot",
      trigger: "onMessage",
      message: "go",
      baseHash,
    });
    expect(
      parseUiMessage({
        schema,
        type: "createScript",
        actorId: "actor:robot",
        trigger: "onMessage",
        message: " ",
        baseHash,
      }),
    ).toBeUndefined();
    expect(
      parseUiMessage({
        schema,
        type: "createScript",
        actorId: "actor:robot",
        trigger: "onKeyPressed",
        baseHash,
      }),
    ).toBeUndefined();
    expect(
      parseUiMessage({
        schema,
        type: "createScript",
        actorId: "actor:robot",
        trigger: "greenFlag",
        baseHash: "bad",
      }),
    ).toBeUndefined();
  });

  it("accepts only bounded embedded art imports", () => {
    const source = `data:image/png;base64,${btoa("\x89PNG\r\n\x1a\nimage")}`;
    expect(
      parseUiMessage({ schema, type: "importAsset", kind: "costume", name: " Nova ", source }),
    ).toEqual({ schema, type: "importAsset", kind: "costume", name: "Nova", source });
    expect(
      parseUiMessage({ schema, type: "importAsset", kind: "sound", name: "Nova", source }),
    ).toBeUndefined();
    expect(
      parseUiMessage({
        schema,
        type: "importAsset",
        kind: "costume",
        name: "Nova",
        source: "https://example.com/image.png",
      }),
    ).toBeUndefined();
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
        type: "validation",
        issues: [
          {
            id: "validation:actor-costume:actor:main",
            severity: "error",
            kind: "missing-costume",
            path: "metadata.actors.items[0].costumeId",
            ref: "asset:costume.missing",
            message: 'Actor "actor:main" references missing costume "asset:costume.missing".',
          },
        ],
      }),
    ).toMatchObject({
      type: "validation",
      issues: [{ kind: "missing-costume", ref: "asset:costume.missing" }],
    });
    expect(
      parseHostMessage({
        schema,
        type: "validation",
        issues: [
          {
            id: "validation:bad",
            severity: "fatal",
            kind: "missing-costume",
            path: "metadata.actors.items[0].costumeId",
            ref: "asset:costume.missing",
            message: "broken",
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

describe("proposalProof host message", () => {
  const ids = {
    actorIds: ["actor:explorer"],
    scriptIds: [],
    assetIds: [],
    variableIds: [],
    nodeIds: ["scripts[0]/statements[0]"],
  };
  const message = {
    schema,
    type: "proposalProof",
    proposalId: "p1",
    decision: "accepted",
    resultProgramHash: "fnv1a32:00000000",
    proof: {
      status: "proved",
      matched: ids,
      missing: { ...ids, actorIds: [], nodeIds: [] },
    },
  };

  it("round-trips a valid message", () => {
    expect(parseHostMessage(message)).toEqual(message);
  });

  it("accepts a rejection without proof", () => {
    const rejected = {
      schema: message.schema,
      type: message.type,
      proposalId: message.proposalId,
      decision: "rejected",
    };
    const parsed = rejected;
    expect(parseHostMessage(parsed)).toEqual(parsed);
  });

  it("rejects malformed decision, status, id and id lists", () => {
    expect(parseHostMessage({ ...message, decision: "maybe" })).toBeUndefined();
    expect(
      parseHostMessage({ ...message, proof: { ...message.proof, status: "great" } }),
    ).toBeUndefined();
    expect(parseHostMessage({ ...message, proposalId: "bad id!" })).toBeUndefined();
    expect(
      parseHostMessage({
        ...message,
        proof: { ...message.proof, matched: { ...ids, actorIds: "actor:explorer" } },
      }),
    ).toBeUndefined();
  });
});

describe("stage frame sound volume", () => {
  const frameWith = (sounds: unknown) => ({
    schema,
    type: "stageFrame",
    frame: {
      state: {
        sprite: { x: 0, y: 0, heading: 0, radius: 10 },
        goal: { x: 100, y: 0, radius: 12 },
        viewport: { width: 264, height: 192 },
        sounds,
      },
      frameIndex: 0,
      frameCount: 1,
      step: 0,
      running: false,
      reachedGoal: false,
    },
  });

  it("round-trips a valid volume and keeps frames without volume unchanged", () => {
    expect(parseHostMessage(frameWith({ activeSoundIds: [], volume: 40 }))).toMatchObject({
      frame: { state: { sounds: { activeSoundIds: [], volume: 40 } } },
    });
    const plain = parseHostMessage(frameWith({ activeSoundIds: [] })) as unknown as {
      frame: { state: { sounds: Record<string, unknown> } };
    };
    expect("volume" in plain.frame.state.sounds).toBe(false);
  });

  it("rejects out-of-range and non-number volume", () => {
    for (const volume of [150, -1, Number.NaN, "loud"]) {
      expect(parseHostMessage(frameWith({ activeSoundIds: [], volume }))).toBeUndefined();
    }
  });
});
