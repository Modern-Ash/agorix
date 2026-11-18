import { describe, expect, it, vi } from "vitest";
import { applyWorkspaceChange, programToWorkspace } from "@agorix/block-editor";
import type { ProjectProgram } from "@agorix/program-model";
import type { ProjectMetadata } from "@agorix/persistence";
import { programSemanticHash } from "@agorix/proposals";
import { STUDIO_PROTOCOL_VERSION as schema, parseUiMessage } from "@agorix/studio-protocol";
import { DEFAULT_AGREEMENTS } from "@agorix/agent-workflow";
import { createStudioSignal } from "@agorix/learning-decision-plane";
import { createWorkbenchHost, type HostPort } from "./workbenchHost.js";

const script = { kind: "script", scriptIndex: 0 } as const;
const base = {
  schema: "agorix/program/v1",
  scripts: [
    {
      id: "main",
      trigger: { type: "onStart" },
      statements: [
        { type: "move", steps: 3 },
        { type: "turn", degrees: 90 },
      ],
    },
  ],
} as unknown as ProjectProgram;

function setup(initial: ProjectProgram | null = base) {
  let program: ProjectProgram | undefined = initial ?? undefined;
  let metadata: ProjectMetadata = {
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    missionProgress: 0,
    hintLevel: 0,
    locale: "en",
  };
  const labels: string[] = [];
  const port: HostPort = {
    historyState: () => ({ canUndo: false, canRedo: false }),
    getProgram: () => program,
    getMetadata: () => (program === undefined ? undefined : metadata),
    commit: async (next, label) => {
      program = next;
      labels.push(label);
    },
    commitMetadata: async (next, label) => {
      metadata = next;
      labels.push(label);
    },
    commitProject: async (nextProgram, nextMetadata, label) => {
      program = nextProgram;
      metadata = nextMetadata;
      labels.push(label);
    },
    openProposalReview: vi.fn(async () => undefined),
    reveal: vi.fn(async () => undefined),
    askAgent: vi.fn(async () => undefined),
    updateAgreements: vi.fn(),
  };
  let n = 0;
  const host = createWorkbenchHost(port, () => `block:wb_${(n += 1)}`);
  return { host, port, labels, get: () => program, metadata: () => metadata };
}

describe("workbenchHost", () => {
  it("commits a nested math function from the visual arithmetic protocol", async () => {
    const program = {
      schema: "agorix/program/v1",
      variables: [{ id: "score", name: "Score", initialValue: 0, visible: true }],
      scripts: [
        {
          id: "main",
          trigger: { type: "onStart" },
          statements: [
            {
              type: "setVariable",
              variableId: "score",
              value: {
                type: "add",
                left: { type: "numericLiteral", value: 1 },
                right: { type: "numericLiteral", value: 2 },
              },
            },
          ],
        },
      ],
    } as unknown as ProjectProgram;
    const { host, get } = setup(program);
    const location = { container: script, index: 0 };
    for (const intent of [
      {
        type: "setArithmeticOperandSource",
        location,
        input: "value",
        side: "left",
        reporter: "mathFunction",
      },
      {
        type: "setArithmeticMathFunction",
        location,
        input: "value",
        side: "left",
        function: "round",
      },
      {
        type: "setArithmeticOperand",
        location,
        input: "value",
        path: ["left"],
        side: "value",
        value: 3.5,
      },
    ]) {
      const message = parseUiMessage({
        schema,
        type: "intent",
        intent,
        baseHash: programSemanticHash(get()!),
      });
      expect(message).toBeDefined();
      expect((await host.handle(message!))[0]).toMatchObject({ type: "workspace" });
    }
    expect(get()?.scripts[0]?.statements[0]).toMatchObject({
      value: {
        type: "add",
        left: { type: "mathFunction", function: "round", value: { value: 3.5 } },
        right: { value: 2 },
      },
    });
  });
  it("commits a visual math function inside a comparison through the protocol", async () => {
    const program = {
      schema: "agorix/program/v1",
      scripts: [
        {
          id: "main",
          trigger: { type: "onStart" },
          statements: [
            {
              type: "if",
              condition: {
                type: "greaterThan",
                left: { type: "numericLiteral", value: 1 },
                right: { type: "numericLiteral", value: 2 },
              },
              then: [],
            },
          ],
        },
      ],
    } as unknown as ProjectProgram;
    const { host, get } = setup(program);
    const location = { container: script, index: 0 };
    for (const intent of [
      { type: "setComparisonOperand", location, side: "left", source: "mathFunction" },
      { type: "setComparisonMathFunction", location, side: "left", function: "round" },
      { type: "setComparisonNestedNumber", location, side: "left", field: "value", value: 3.5 },
    ]) {
      const message = parseUiMessage({
        schema,
        type: "intent",
        intent,
        baseHash: programSemanticHash(get()!),
      });
      expect(message).toBeDefined();
      expect((await host.handle(message!))[0]).toMatchObject({ type: "workspace" });
    }
    expect(get()?.scripts[0]?.statements[0]).toMatchObject({
      condition: {
        left: { type: "mathFunction", function: "round", value: { value: 3.5 } },
        right: { value: 2 },
      },
    });
  });
  it("commits a comparison range edit received through the UI protocol", async () => {
    const program = {
      schema: "agorix/program/v1",
      scripts: [
        {
          id: "main",
          trigger: { type: "onStart" },
          statements: [
            {
              type: "if",
              condition: {
                type: "greaterThan",
                left: {
                  type: "randomInteger",
                  min: { type: "numericLiteral", value: 1 },
                  max: { type: "numericLiteral", value: 5 },
                },
                right: { type: "numericLiteral", value: 3 },
              },
              then: [],
            },
          ],
        },
      ],
    } as unknown as ProjectProgram;
    const { host, get } = setup(program);
    const message = parseUiMessage({
      schema,
      type: "intent",
      intent: {
        type: "setComparisonNestedNumber",
        location: { container: script, index: 0 },
        side: "left",
        field: "max",
        value: 9,
      },
      baseHash: programSemanticHash(program),
    });
    expect(message).toBeDefined();
    const response = await host.handle(message!);
    expect(response[0]).toMatchObject({ type: "workspace" });
    expect(get()?.scripts[0]?.statements[0]).toMatchObject({
      condition: { left: { type: "randomInteger", max: { value: 9 } } },
    });
  });
  it("commits a logical comparison edit received through the UI protocol", async () => {
    const program = {
      schema: "agorix/program/v1",
      scripts: [
        {
          id: "main",
          trigger: { type: "onStart" },
          statements: [
            {
              type: "if",
              condition: {
                type: "and",
                left: {
                  type: "greaterThan",
                  left: { type: "numericLiteral", value: 1 },
                  right: { type: "numericLiteral", value: 2 },
                },
                right: { type: "booleanLiteral", value: true },
              },
              then: [],
            },
          ],
        },
      ],
    } as unknown as ProjectProgram;
    const { host, get } = setup(program);
    const message = parseUiMessage({
      schema,
      type: "intent",
      intent: {
        type: "setLogicalComparisonNumber",
        location: { container: script, index: 0 },
        side: "left",
        operand: "right",
        value: 4,
      },
      baseHash: programSemanticHash(program),
    });
    expect(message).toBeDefined();
    expect((await host.handle(message!))[0]).toMatchObject({ type: "workspace" });
    expect(get()?.scripts[0]?.statements[0]).toMatchObject({
      condition: { type: "and", left: { type: "greaterThan", right: { value: 4 } } },
    });
  });
  it("commits a two-level arithmetic edit and refuses a stale nested value", async () => {
    const { host, get } = setup();
    await host.handle({
      schema,
      type: "intent",
      intent: { type: "addVariable", name: "score" },
      baseHash: programSemanticHash(get()!),
    });
    await host.handle({
      schema,
      type: "intent",
      intent: {
        type: "insertBlock",
        blockType: "variables_set",
        to: { container: script, index: 0 },
      },
      baseHash: programSemanticHash(get()!),
    });
    const location = { container: script, index: 0 };
    await host.handle({
      schema,
      type: "intent",
      intent: { type: "setNumericInput", location, input: "value", reporter: "add" },
      baseHash: programSemanticHash(get()!),
    });
    const beforeNested = get()!;
    const source = {
      type: "setArithmeticOperandSource",
      location,
      input: "value",
      side: "left",
      reporter: "multiply",
    } as const;
    expect(
      (
        await host.handle({
          schema,
          type: "intent",
          intent: source,
          baseHash: programSemanticHash(beforeNested),
        })
      )[0],
    ).toMatchObject({ type: "workspace" });
    const edit = {
      type: "setArithmeticOperand",
      location,
      input: "value",
      path: ["left"],
      side: "right",
      value: 6,
    } as const;
    expect(
      (
        await host.handle({
          schema,
          type: "intent",
          intent: edit,
          baseHash: programSemanticHash(get()!),
        })
      )[0],
    ).toMatchObject({ type: "workspace" });
    expect(get()?.scripts[0]?.statements[0]).toMatchObject({
      value: { type: "add", left: { type: "multiply", right: { value: 6 } } },
    });
    expect(
      (
        await host.handle({
          schema,
          type: "intent",
          intent: edit,
          baseHash: programSemanticHash(beforeNested),
        })
      )[0],
    ).toMatchObject({ type: "error", code: "STALE_EDIT" });
  });
  it("edits a visual layer block through canonical state and refuses invalid layers", async () => {
    const { host, get, labels } = setup();
    const inserted = await host.handle({
      schema,
      type: "intent",
      intent: {
        type: "insertBlock",
        blockType: "looks_go_to_layer",
        to: { container: script, index: 0 },
      },
      baseHash: programSemanticHash(get()!),
    });
    expect(inserted[0]).toMatchObject({ type: "workspace" });
    expect(get()?.scripts[0]?.statements[0]).toMatchObject({ type: "goToLayer", layer: "front" });
    const location = { container: script, index: 0 };
    const changed = await host.handle({
      schema,
      type: "intent",
      intent: { type: "setTextField", location, field: "layer", value: "back" },
      baseHash: programSemanticHash(get()!),
    });
    expect(changed[0]).toMatchObject({ type: "workspace" });
    expect(get()?.scripts[0]?.statements[0]).toMatchObject({ type: "goToLayer", layer: "back" });
    const before = get();
    const count = labels.length;
    const rejected = await host.handle({
      schema,
      type: "intent",
      intent: { type: "setTextField", location, field: "layer", value: "middle" },
      baseHash: programSemanticHash(before!),
    });
    expect(rejected[0]).toMatchObject({ type: "error", code: "INVALID_CHANGE" });
    expect(get()).toBe(before);
    expect(labels).toHaveLength(count);
  });
  it("inserts visual pointing blocks and accepts only a known target actor", async () => {
    const { host, get, metadata, labels } = setup();
    await host.handle({ schema, type: "createActor", name: "Robot" });
    const robotId = metadata().actors!.items.find((actor) => actor.name === "Robot")!.id;
    for (const blockType of ["motion_point_in_direction", "motion_point_towards"] as const) {
      const result = await host.handle({
        schema,
        type: "intent",
        intent: { type: "insertBlock", blockType, to: { container: script, index: 0 } },
        baseHash: programSemanticHash(get()!),
      });
      expect(result[0]).toMatchObject({ type: "workspace" });
    }
    const location = { container: script, index: 0 };
    const accepted = await host.handle({
      schema,
      type: "intent",
      intent: { type: "setTextField", location, field: "actorId", value: robotId },
      baseHash: programSemanticHash(get()!),
    });
    expect(accepted[0]).toMatchObject({ type: "workspace" });
    expect(get()?.scripts[0]?.statements[0]).toMatchObject({
      type: "pointTowards",
      actorId: robotId,
    });
    expect(get()?.scripts[0]?.statements[1]).toMatchObject({
      type: "pointInDirection",
      degrees: 90,
    });
    const before = get();
    const count = labels.length;
    const rejected = await host.handle({
      schema,
      type: "intent",
      intent: { type: "setTextField", location, field: "actorId", value: "actor:missing" },
      baseHash: programSemanticHash(before!),
    });
    expect(rejected[0]).toMatchObject({ type: "error", code: "INVALID_CHANGE" });
    expect(get()).toBe(before);
    expect(labels).toHaveLength(count);
  });
  it("persists a known backdrop and refuses unknown assets", async () => {
    const { host, port, metadata, labels } = setup();
    await port.commitMetadata(
      {
        ...metadata(),
        assets: [
          {
            id: "backdrop:moon",
            kind: "backdrop",
            name: "Moon",
            source: "builtin:kids-gallery-backdrop:moon",
          },
        ],
      },
      "test fixture",
    );
    const before = labels.length;
    const accepted = await host.handle({
      schema,
      type: "updateStage",
      backdropId: "backdrop:moon",
    });
    expect(accepted).toContainEqual({ schema, type: "scene", backdropId: "backdrop:moon" });
    expect(metadata().stage?.backdropId).toBe("backdrop:moon");
    const refused = await host.handle({
      schema,
      type: "updateStage",
      backdropId: "backdrop:missing",
    });
    expect(refused[0]).toMatchObject({ type: "error", code: "INVALID_CHANGE" });
    expect(metadata().stage?.backdropId).toBe("backdrop:moon");
    expect(labels).toHaveLength(before + 1);
  });
  it("sends project costume and backdrop art alongside the built-in catalog", async () => {
    const { host, port, metadata } = setup();
    await port.commitMetadata(
      {
        ...metadata(),
        assets: [
          {
            id: "costume:nova",
            kind: "costume",
            name: "Nova",
            source: "builtin:kids-gallery-costume:nova",
          },
          {
            id: "backdrop:moon",
            kind: "backdrop",
            name: "Moon",
            source: "builtin:kids-gallery-backdrop:moon",
          },
        ],
      },
      "test fixture",
    );
    const assets = host.snapshot().find((message) => message.type === "assets");
    expect(assets).toMatchObject({
      assets: expect.arrayContaining([
        expect.objectContaining({
          id: "costume:nova",
          source: "builtin:kids-gallery-costume:nova",
        }),
        expect.objectContaining({
          id: "backdrop:moon",
          source: "builtin:kids-gallery-backdrop:moon",
        }),
      ]),
    });
    const catalog = assets?.type === "assets" ? assets.assets : [];
    expect(
      catalog.filter((asset) => asset.kind === "costume" && asset.tags.includes("gallery")),
    ).toHaveLength(12);
    expect(
      catalog.filter((asset) => asset.kind === "backdrop" && asset.tags.includes("gallery")),
    ).toHaveLength(9);
    expect(catalog).toContainEqual(
      expect.objectContaining({
        id: "costume:mika",
        source: "builtin:kids-gallery-costume:mika",
      }),
    );
    expect(catalog).toContainEqual(
      expect.objectContaining({
        id: "backdrop:forest",
        source: "builtin:kids-gallery-backdrop:forest",
      }),
    );
  });

  it("exposes only bundled sound sources to the visual preview", async () => {
    const { host, port, metadata } = setup();
    await port.commitMetadata(
      {
        ...metadata(),
        assets: [
          { id: "asset:sound.chime", kind: "sound", name: "Chime", source: "builtin:sound.chime" },
          {
            id: "sound:remote",
            kind: "sound",
            name: "Remote",
            source: "https://example.com/a.wav",
          },
        ],
      },
      "test fixture",
    );
    const message = host.snapshot().find((item) => item.type === "assets");
    const assets = message?.type === "assets" ? message.assets : [];
    expect(assets.find((asset) => asset.id === "asset:sound.chime")?.source).toBe(
      "builtin:sound.chime",
    );
    expect(assets.find((asset) => asset.id === "sound:remote")?.source).toBeUndefined();
  });
  it("answers ready with the workspace and hash, or nothing without a project", async () => {
    const { host } = setup();
    expect(await host.handle({ schema, type: "ready" })).toMatchObject([
      {
        schema,
        type: "workspace",
        workspace: programToWorkspace(base).workspace,
        programHash: programSemanticHash(base),
      },
      {
        schema,
        type: "actors",
        actors: [{ id: "actor:main", costumeId: "asset:costume.default", scriptCount: 1 }],
      },
      { schema, type: "scene", backdropId: "asset:space.trailhead" },
      { schema, type: "assets" },
      { schema, type: "validation", issues: [] },
      { schema, type: "missionSpec", spec: { successCheck: "touches-goal" } },
    ]);
    expect(await setup(null).host.handle({ schema, type: "ready" })).toEqual([]);
  });

  it("sends pure loop findings with the canonical workspace snapshot", () => {
    const program = {
      ...base,
      scripts: [
        {
          ...base.scripts[0]!,
          statements: [
            {
              type: "repeatUntil",
              condition: { type: "booleanLiteral", value: false },
              body: [{ type: "move", steps: 1 }],
            },
          ],
        },
      ],
    } as ProjectProgram;
    const { host } = setup(program);
    expect(host.snapshot()[0]).toMatchObject({
      type: "workspace",
      findings: [{ kind: "loop-never-exits", nodeId: "scripts[0]/statements[0]" }],
    });
    expect(setup().host.snapshot()[0]).toMatchObject({ findings: [] });
  });

  it("persists learner-editable mission specs as metadata", async () => {
    const { host, labels, metadata } = setup();
    const out = await host.handle({
      schema,
      type: "updateMissionSpec",
      spec: {
        goal: "Guide the rocket to the beacon.",
        successCheck: "touches-goal",
        predictionPrompt: "Will it touch the beacon?",
      },
    });

    expect(labels).toEqual(["Workbench: update mission spec"]);
    expect(metadata().missionSpec).toEqual({
      goal: "Guide the rocket to the beacon.",
      successCheck: "touches-goal",
      predictionPrompt: "Will it touch the beacon?",
    });
    expect(out).toMatchObject([
      {
        type: "missionSpec",
        spec: {
          goal: "Guide the rocket to the beacon.",
          successCheck: "touches-goal",
          hash: expect.stringMatching(/^mission:/),
        },
      },
    ]);
  });

  it("inserts through the canonical path and reports the new hash", async () => {
    const { host, labels, get } = setup();
    const out = await host.handle({
      schema,
      type: "intent",
      intent: {
        type: "insertBlock",
        blockType: "motion_move",
        to: { container: script, index: 0 },
      },
      baseHash: programSemanticHash(base),
    });
    expect(get()?.scripts[0]?.statements).toHaveLength(3);
    expect(labels[0]).toMatch(/^Workbench:/);
    expect(out[0]).toMatchObject({ type: "workspace", programHash: programSemanticHash(get()!) });
  });

  it("commits numeric edits and refuses stale or unknown fields", async () => {
    const { host, get, labels } = setup();
    const intent = {
      type: "setNumericField",
      location: { container: script, index: 0 },
      field: "steps",
      value: 21,
    } as const;
    const changed = await host.handle({
      schema,
      type: "intent",
      intent,
      baseHash: programSemanticHash(base),
    });
    expect(changed[0]).toMatchObject({ type: "workspace" });
    expect(get()?.scripts[0]?.statements[0]).toMatchObject({ type: "move", steps: 21 });
    expect(labels).toHaveLength(1);
    const stale = await host.handle({
      schema,
      type: "intent",
      intent,
      baseHash: programSemanticHash(base),
    });
    expect(stale[0]).toMatchObject({ type: "error", code: "STALE_EDIT" });
    const bad = await host.handle({
      schema,
      type: "intent",
      intent: { ...intent, field: "missing" },
      baseHash: programSemanticHash(get()!),
    });
    expect(bad[0]).toMatchObject({ type: "error", code: "INVALID_CHANGE" });
    expect(labels).toHaveLength(1);
  });

  it("commits text edits only to existing string fields", async () => {
    const { host, get, labels } = setup();
    await host.handle({
      schema,
      type: "intent",
      intent: { type: "insertBlock", blockType: "looks_say", to: { container: script, index: 0 } },
      baseHash: programSemanticHash(base),
    });
    const current = get()!;
    const edited = await host.handle({
      schema,
      type: "intent",
      intent: {
        type: "setTextField",
        location: { container: script, index: 0 },
        field: "text",
        value: "Hola",
      },
      baseHash: programSemanticHash(current),
    });
    expect(edited[0]).toMatchObject({ type: "workspace" });
    expect(get()?.scripts[0]?.statements[0]).toMatchObject({ type: "say", text: "Hola" });
    const refused = await host.handle({
      schema,
      type: "intent",
      intent: {
        type: "setTextField",
        location: { container: script, index: 0 },
        field: "steps",
        value: "bad",
      },
      baseHash: programSemanticHash(get()!),
    });
    expect(refused[0]).toMatchObject({ type: "error", code: "INVALID_CHANGE" });
    expect(labels).toHaveLength(2);
  });

  it("commits a visual condition and refuses stale or non-condition edits", async () => {
    const conditional = {
      schema: "agorix/program/v1",
      scripts: [
        {
          id: "main",
          trigger: { type: "onStart" },
          statements: [{ type: "if", condition: { type: "touchingGoal" }, then: [] }],
        },
      ],
    } as unknown as ProjectProgram;
    const { host, get, labels } = setup(conditional);
    const intent = {
      type: "replaceCondition",
      location: { container: script, index: 0 },
      blockType: "literal_boolean",
    } as const;
    const accepted = await host.handle({
      schema,
      type: "intent",
      intent,
      baseHash: programSemanticHash(conditional),
    });
    expect(accepted[0]).toMatchObject({ type: "workspace" });
    expect(get()?.scripts[0]?.statements[0]).toMatchObject({
      type: "if",
      condition: { type: "booleanLiteral", value: true },
    });
    expect(labels).toHaveLength(1);
    expect(
      (
        await host.handle({
          schema,
          type: "intent",
          intent,
          baseHash: programSemanticHash(conditional),
        })
      )[0],
    ).toMatchObject({ type: "error", code: "STALE_EDIT" });
    expect(
      (
        await host.handle({
          schema,
          type: "intent",
          intent: { ...intent, location: { container: script, index: 1 } },
          baseHash: programSemanticHash(get()!),
        })
      )[0],
    ).toMatchObject({ type: "error", code: "INVALID_CHANGE" });
    expect(labels).toHaveLength(1);
  });

  it("commits numeric comparison operands and refuses stale or missing comparisons", async () => {
    const conditional = {
      schema: "agorix/program/v1",
      scripts: [
        {
          id: "main",
          trigger: { type: "onStart" },
          statements: [{ type: "if", condition: { type: "touchingGoal" }, then: [] }],
        },
      ],
    } as unknown as ProjectProgram;
    const { host, get, labels } = setup(conditional);
    await host.handle({
      schema,
      type: "intent",
      intent: {
        type: "replaceCondition",
        location: { container: script, index: 0 },
        blockType: "operator_greater_than",
      },
      baseHash: programSemanticHash(conditional),
    });
    const afterComparison = get()!;
    const intent = {
      type: "setConditionNumber",
      location: { container: script, index: 0 },
      side: "right",
      value: 5,
    } as const;
    const accepted = await host.handle({
      schema,
      type: "intent",
      intent,
      baseHash: programSemanticHash(afterComparison),
    });
    expect(accepted[0]).toMatchObject({ type: "workspace" });
    expect(get()?.scripts[0]?.statements[0]).toMatchObject({
      type: "if",
      condition: { type: "greaterThan", right: { type: "numericLiteral", value: 5 } },
    });
    expect(
      (
        await host.handle({
          schema,
          type: "intent",
          intent,
          baseHash: programSemanticHash(afterComparison),
        })
      )[0],
    ).toMatchObject({ type: "error", code: "STALE_EDIT" });
    expect(
      (
        await host.handle({
          schema,
          type: "intent",
          intent: { ...intent, location: { container: script, index: 1 } },
          baseHash: programSemanticHash(get()!),
        })
      )[0],
    ).toMatchObject({ type: "error", code: "INVALID_CHANGE" });
    expect(labels).toHaveLength(2);
  });
  it("commits Boolean and actor contact edits with actor validation", async () => {
    const conditional = {
      schema: "agorix/program/v1",
      scripts: [
        {
          id: "main",
          trigger: { type: "onStart" },
          statements: [
            { type: "if", condition: { type: "booleanLiteral", value: true }, then: [] },
          ],
        },
      ],
    } as unknown as ProjectProgram;
    const { host, get, metadata, labels } = setup(conditional);
    const location = { container: script, index: 0 };
    await host.handle({
      schema,
      type: "intent",
      intent: { type: "setConditionBoolean", location, value: false },
      baseHash: programSemanticHash(get()!),
    });
    expect(get()?.scripts[0]?.statements[0]).toMatchObject({
      type: "if",
      condition: { type: "booleanLiteral", value: false },
    });
    await host.handle({ schema, type: "createActor", name: "Robot" });
    const robotId = metadata().actors!.items.find((actor) => actor.name === "Robot")!.id;
    await host.handle({
      schema,
      type: "intent",
      intent: { type: "replaceCondition", location, blockType: "sensing_touching_actor" },
      baseHash: programSemanticHash(get()!),
    });
    const before = get()!;
    const intent = { type: "setConditionActor", location, actorId: robotId } as const;
    expect(
      (
        await host.handle({ schema, type: "intent", intent, baseHash: programSemanticHash(before) })
      )[0],
    ).toMatchObject({ type: "workspace" });
    expect(get()?.scripts[0]?.statements[0]).toMatchObject({
      type: "if",
      condition: { type: "touchingActor", actorId: robotId },
    });
    const count = labels.length;
    expect(
      (
        await host.handle({ schema, type: "intent", intent, baseHash: programSemanticHash(before) })
      )[0],
    ).toMatchObject({ type: "error", code: "STALE_EDIT" });
    expect(
      (
        await host.handle({
          schema,
          type: "intent",
          intent: { ...intent, actorId: "actor:missing" },
          baseHash: programSemanticHash(get()!),
        })
      )[0],
    ).toMatchObject({ type: "error", code: "INVALID_CHANGE" });
    expect(labels).toHaveLength(count);
  });

  it("commits variable creation, selection and values while refusing stale edits", async () => {
    const { host, get, labels } = setup();
    await host.handle({
      schema,
      type: "intent",
      intent: { type: "addVariable", name: "energy" },
      baseHash: programSemanticHash(base),
    });
    expect(get()?.variables?.[0]).toMatchObject({ name: "energy", initialValue: 0 });
    const variableId = get()!.variables![0]!.id;
    await host.handle({
      schema,
      type: "intent",
      intent: {
        type: "insertBlock",
        blockType: "variables_set",
        to: { container: script, index: 0 },
      },
      baseHash: programSemanticHash(get()!),
    });
    await host.handle({
      schema,
      type: "intent",
      intent: {
        type: "setTextField",
        location: { container: script, index: 0 },
        field: "variableId",
        value: variableId,
      },
      baseHash: programSemanticHash(get()!),
    });
    const before = get()!;
    const intent = {
      type: "setExpressionNumber",
      location: { container: script, index: 0 },
      input: "value",
      value: 14,
    } as const;
    expect(
      (
        await host.handle({ schema, type: "intent", intent, baseHash: programSemanticHash(before) })
      )[0],
    ).toMatchObject({ type: "workspace" });
    expect(get()?.scripts[0]?.statements[0]).toMatchObject({
      type: "setVariable",
      variableId,
      value: { type: "numericLiteral", value: 14 },
    });
    expect(
      (
        await host.handle({ schema, type: "intent", intent, baseHash: programSemanticHash(before) })
      )[0],
    ).toMatchObject({ type: "error", code: "STALE_EDIT" });
    expect(
      (
        await host.handle({
          schema,
          type: "intent",
          intent: { ...intent, input: "delta" },
          baseHash: programSemanticHash(get()!),
        })
      )[0],
    ).toMatchObject({ type: "error", code: "INVALID_CHANGE" });
    expect(labels).toHaveLength(4);
  });
  it("renames variables and refuses to delete referenced variables", async () => {
    const { host, get } = setup();
    const post = async (intent: Parameters<typeof host.handle>[0] & { type: "intent" }) =>
      host.handle(intent);
    await post({
      schema,
      type: "intent",
      intent: { type: "addVariable", name: "energy" },
      baseHash: programSemanticHash(base),
    });
    const variableId = get()!.variables![0]!.id;
    await post({
      schema,
      type: "intent",
      intent: { type: "renameVariable", variableId, name: "Power" },
      baseHash: programSemanticHash(get()!),
    });
    expect(get()?.variables?.[0]).toMatchObject({ id: variableId, name: "Power" });
    await post({
      schema,
      type: "intent",
      intent: {
        type: "insertBlock",
        blockType: "variables_set",
        to: { container: script, index: 0 },
      },
      baseHash: programSemanticHash(get()!),
    });
    await post({
      schema,
      type: "intent",
      intent: {
        type: "setTextField",
        location: { container: script, index: 0 },
        field: "variableId",
        value: variableId,
      },
      baseHash: programSemanticHash(get()!),
    });
    const before = get()!;
    expect(
      (
        await post({
          schema,
          type: "intent",
          intent: { type: "deleteVariable", variableId },
          baseHash: programSemanticHash(before),
        })
      )[0],
    ).toMatchObject({ type: "error", code: "INVALID_CHANGE" });
    expect(get()).toEqual(before);
  });
  it("commits declaration defaults and watcher toggles while refusing stale and missing edits", async () => {
    const { host, get } = setup();
    const post = async (intent: Parameters<typeof host.handle>[0] & { type: "intent" }) =>
      host.handle(intent);
    await post({
      schema,
      type: "intent",
      intent: { type: "addVariable", name: "score" },
      baseHash: programSemanticHash(base),
    });
    const variableId = get()!.variables![0]!.id;
    await post({
      schema,
      type: "intent",
      intent: { type: "addList", name: "items" },
      baseHash: programSemanticHash(get()!),
    });
    const listId = get()!.lists![0]!.id;
    const before = get()!;
    await post({
      schema,
      type: "intent",
      intent: { type: "setVariableInitialValue", variableId, value: 7 },
      baseHash: programSemanticHash(before),
    });
    expect(get()?.variables?.[0]?.initialValue).toBe(7);
    expect(
      (
        await post({
          schema,
          type: "intent",
          intent: { type: "setVariableVisible", variableId, visible: false },
          baseHash: programSemanticHash(before),
        })
      )[0],
    ).toMatchObject({ type: "error", code: "STALE_EDIT" });
    await post({
      schema,
      type: "intent",
      intent: { type: "setVariableVisible", variableId, visible: false },
      baseHash: programSemanticHash(get()!),
    });
    await post({
      schema,
      type: "intent",
      intent: { type: "setListVisible", listId, visible: false },
      baseHash: programSemanticHash(get()!),
    });
    expect(get()?.variables?.[0]?.visible).toBe(false);
    expect(get()?.lists?.[0]?.visible).toBe(false);
    const accepted = get()!;
    expect(
      (
        await post({
          schema,
          type: "intent",
          intent: { type: "setVariableInitialValue", variableId: "missing", value: 1 },
          baseHash: programSemanticHash(accepted),
        })
      )[0],
    ).toMatchObject({ type: "error", code: "INVALID_CHANGE" });
    expect(
      (
        await post({
          schema,
          type: "intent",
          intent: { type: "setListVisible", listId: "missing", visible: true },
          baseHash: programSemanticHash(accepted),
        })
      )[0],
    ).toMatchObject({ type: "error", code: "INVALID_CHANGE" });
    expect(get()).toEqual(accepted);
  });

  it("creates a list and visual list operations while rejecting stale and unknown list edits", async () => {
    const { host, get, labels } = setup();
    const post = (intent: Parameters<typeof host.handle>[0] & { type: "intent" }) =>
      host.handle(intent);
    await post({
      schema,
      type: "intent",
      intent: { type: "addList", name: "items" },
      baseHash: programSemanticHash(base),
    });
    const listId = get()!.lists![0]!.id;
    expect(get()?.lists?.[0]).toMatchObject({ name: "items", initialItems: [] });
    expect(
      (
        await post({
          schema,
          type: "intent",
          intent: { type: "addList", name: "ITEMS" },
          baseHash: programSemanticHash(get()!),
        })
      )[0],
    ).toMatchObject({ type: "error", code: "INVALID_CHANGE" });
    await post({
      schema,
      type: "intent",
      intent: {
        type: "insertBlock",
        blockType: "lists_insert_at",
        to: { container: script, index: 0 },
      },
      baseHash: programSemanticHash(get()!),
    });
    expect(get()?.scripts[0]?.statements[0]).toMatchObject({ type: "listInsertAt", listId });
    const before = get()!;
    await post({
      schema,
      type: "intent",
      intent: {
        type: "setExpressionNumber",
        location: { container: script, index: 0 },
        input: "index",
        value: 2,
      },
      baseHash: programSemanticHash(before),
    });
    expect(get()?.scripts[0]?.statements[0]).toMatchObject({
      type: "listInsertAt",
      index: { type: "numericLiteral", value: 2 },
    });
    expect(
      (
        await post({
          schema,
          type: "intent",
          intent: {
            type: "setTextField",
            location: { container: script, index: 0 },
            field: "listId",
            value: "missing",
          },
          baseHash: programSemanticHash(get()!),
        })
      )[0],
    ).toMatchObject({ type: "error", code: "INVALID_CHANGE" });
    expect(
      (
        await post({
          schema,
          type: "intent",
          intent: { type: "addList", name: "later" },
          baseHash: programSemanticHash(before),
        })
      )[0],
    ).toMatchObject({ type: "error", code: "STALE_EDIT" });
    expect(labels).toHaveLength(3);
  });
  it("renames lists and refuses to delete referenced lists", async () => {
    const { host, get } = setup();
    const post = async (intent: Parameters<typeof host.handle>[0] & { type: "intent" }) =>
      host.handle(intent);
    await post({
      schema,
      type: "intent",
      intent: { type: "addList", name: "items" },
      baseHash: programSemanticHash(base),
    });
    const listId = get()!.lists![0]!.id;
    await post({
      schema,
      type: "intent",
      intent: { type: "renameList", listId, name: "inventory" },
      baseHash: programSemanticHash(get()!),
    });
    expect(get()?.lists?.[0]).toMatchObject({ id: listId, name: "inventory" });
    await post({
      schema,
      type: "intent",
      intent: { type: "insertBlock", blockType: "lists_add", to: { container: script, index: 0 } },
      baseHash: programSemanticHash(get()!),
    });
    const before = get()!;
    expect(
      (
        await post({
          schema,
          type: "intent",
          intent: { type: "deleteList", listId },
          baseHash: programSemanticHash(before),
        })
      )[0],
    ).toMatchObject({ type: "error", code: "INVALID_CHANGE" });
    expect(get()).toEqual(before);
  });
  it("commits a numeric list reporter and refuses missing references or stale edits", async () => {
    const { host, get, labels } = setup();
    await host.handle({
      schema,
      type: "intent",
      intent: { type: "addList", name: "items" },
      baseHash: programSemanticHash(base),
    });
    const listId = get()!.lists![0]!.id;
    await host.handle({
      schema,
      type: "intent",
      intent: { type: "insertBlock", blockType: "lists_add", to: { container: script, index: 0 } },
      baseHash: programSemanticHash(get()!),
    });
    const before = get()!;
    const intent = {
      type: "setNumericInput",
      location: { container: script, index: 0 },
      input: "value",
      reporter: "listLength",
      referenceId: listId,
    } as const;
    expect(
      (
        await host.handle({ schema, type: "intent", intent, baseHash: programSemanticHash(before) })
      )[0],
    ).toMatchObject({ type: "workspace" });
    expect(get()?.scripts[0]?.statements[0]).toMatchObject({
      type: "listAdd",
      value: { type: "listLength", listId },
    });
    const count = labels.length;
    expect(
      (
        await host.handle({ schema, type: "intent", intent, baseHash: programSemanticHash(before) })
      )[0],
    ).toMatchObject({ type: "error", code: "STALE_EDIT" });
    expect(
      (
        await host.handle({
          schema,
          type: "intent",
          intent: { ...intent, referenceId: "missing" },
          baseHash: programSemanticHash(get()!),
        })
      )[0],
    ).toMatchObject({ type: "error", code: "INVALID_CHANGE" });
    expect(labels).toHaveLength(count);
  });
  it("commits actor distance only for a known actor", async () => {
    const { host, get } = setup();
    await host.handle({
      schema,
      type: "intent",
      intent: { type: "addVariable", name: "distance" },
      baseHash: programSemanticHash(get()!),
    });
    await host.handle({
      schema,
      type: "intent",
      intent: {
        type: "insertBlock",
        blockType: "variables_set",
        to: { container: script, index: 0 },
      },
      baseHash: programSemanticHash(get()!),
    });
    const intent = {
      type: "setNumericInput",
      location: { container: script, index: 0 },
      input: "value",
      reporter: "distanceToActor",
      referenceId: "actor:main",
    } as const;
    expect(
      (
        await host.handle({ schema, type: "intent", intent, baseHash: programSemanticHash(get()!) })
      )[0],
    ).toMatchObject({ type: "workspace" });
    expect(get()?.scripts[0]?.statements[0]).toMatchObject({
      type: "setVariable",
      value: { type: "distanceToActor", actorId: "actor:main" },
    });
    expect(
      (
        await host.handle({
          schema,
          type: "intent",
          intent: { ...intent, referenceId: "actor:missing" },
          baseHash: programSemanticHash(get()!),
        })
      )[0],
    ).toMatchObject({ type: "error", code: "INVALID_CHANGE" });
  });
  it("commits arithmetic reporters and refuses invalid operand edits", async () => {
    const { host, get } = setup();
    await host.handle({
      schema,
      type: "intent",
      intent: { type: "addVariable", name: "math" },
      baseHash: programSemanticHash(get()!),
    });
    await host.handle({
      schema,
      type: "intent",
      intent: {
        type: "insertBlock",
        blockType: "variables_set",
        to: { container: script, index: 0 },
      },
      baseHash: programSemanticHash(get()!),
    });
    const location = { container: script, index: 0 };
    expect(
      (
        await host.handle({
          schema,
          type: "intent",
          intent: { type: "setNumericInput", location, input: "value", reporter: "multiply" },
          baseHash: programSemanticHash(get()!),
        })
      )[0],
    ).toMatchObject({ type: "workspace" });
    expect(
      (
        await host.handle({
          schema,
          type: "intent",
          intent: {
            type: "setArithmeticOperand",
            location,
            input: "value",
            side: "right",
            value: 4,
          },
          baseHash: programSemanticHash(get()!),
        })
      )[0],
    ).toMatchObject({ type: "workspace" });
    expect(get()?.scripts[0]?.statements[0]).toMatchObject({
      type: "setVariable",
      value: { type: "multiply", right: { type: "numericLiteral", value: 4 } },
    });
    const variableId = get()!.variables![0]!.id;
    const beforeSource = get()!;
    const source = {
      type: "setArithmeticOperandSource",
      location,
      input: "value",
      side: "left",
      reporter: "variable",
      referenceId: variableId,
    } as const;
    expect(
      (
        await host.handle({
          schema,
          type: "intent",
          intent: source,
          baseHash: programSemanticHash(beforeSource),
        })
      )[0],
    ).toMatchObject({ type: "workspace" });
    expect(get()?.scripts[0]?.statements[0]).toMatchObject({
      value: { type: "multiply", left: { type: "variable", variableId }, right: { value: 4 } },
    });
    expect(
      (
        await host.handle({
          schema,
          type: "intent",
          intent: { ...source, referenceId: "unknown" },
          baseHash: programSemanticHash(get()!),
        })
      )[0],
    ).toMatchObject({ type: "error", code: "INVALID_CHANGE" });
    expect(
      (
        await host.handle({
          schema,
          type: "intent",
          intent: { ...source, reporter: "distanceToActor", referenceId: "actor:missing" },
          baseHash: programSemanticHash(get()!),
        })
      )[0],
    ).toMatchObject({ type: "error", code: "INVALID_CHANGE" });
    expect(
      (
        await host.handle({
          schema,
          type: "intent",
          intent: {
            type: "setArithmeticOperandSource",
            location,
            input: "value",
            side: "left",
            reporter: "number",
          },
          baseHash: programSemanticHash(beforeSource),
        })
      )[0],
    ).toMatchObject({ type: "error", code: "STALE_EDIT" });
    expect(
      (
        await host.handle({
          schema,
          type: "intent",
          intent: {
            type: "setArithmeticOperand",
            location,
            input: "index",
            side: "right",
            value: 2,
          },
          baseHash: programSemanticHash(get()!),
        })
      )[0],
    ).toMatchObject({ type: "error", code: "INVALID_CHANGE" });
  });

  it("creates an actor and its script in one project transaction with explicit ownership", async () => {
    const { host, get, metadata, labels } = setup();
    const result = await host.handle({ schema, type: "createActor", name: "Robot" });
    const actorSet = metadata().actors!;
    const robot = actorSet.items.find((actor) => actor.name === "Robot")!;
    expect(robot.scripts).toHaveLength(1);
    expect(get()?.scripts.map((script) => script.id)).toContain(robot.scripts![0]);
    expect(actorSet.items[0]?.scripts).toEqual(base.scripts.map((script) => script.id));
    expect(metadata().stage?.actorOrder).toContain(robot.id);
    expect(result.find((message) => message.type === "actors")).toMatchObject({
      selectedActorId: robot.id,
      actors: expect.arrayContaining([
        expect.objectContaining({ id: robot.id, scriptIds: robot.scripts }),
      ]),
    });
    expect(labels).toEqual(["Workbench: create actor and script"]);
  });

  it("creates a gallery character with its chosen costume and refuses unknown costumes atomically", async () => {
    const { host, get, metadata, labels } = setup();
    const before = get()!.scripts.length;
    expect(
      (
        await host.handle({
          schema,
          type: "createActor",
          name: "Unknown",
          costumeId: "costume:missing",
        })
      )[0],
    ).toMatchObject({ type: "error", code: "INVALID_CHANGE" });
    expect(get()!.scripts).toHaveLength(before);
    expect(labels).toEqual([]);
    const result = await host.handle({
      schema,
      type: "createActor",
      name: "Mika",
      costumeId: "costume:mika",
    });
    const actor = metadata().actors!.items.find((item) => item.name === "Mika")!;
    expect(actor.costumeId).toBe("costume:mika");
    expect(metadata().assets).toContainEqual(
      expect.objectContaining({ id: "costume:mika", source: "builtin:kids-gallery-costume:mika" }),
    );
    expect(actor.scripts).toHaveLength(1);
    expect(get()!.scripts).toHaveLength(before + 1);
    expect(result).toContainEqual(
      expect.objectContaining({
        type: "actors",
        selectedActorId: actor.id,
        actors: expect.arrayContaining([
          expect.objectContaining({ id: actor.id, costumeId: "costume:mika" }),
        ]),
      }),
    );
    expect(labels).toEqual(["Workbench: create actor and script"]);
  });

  it("materializes gallery assets before actor, stage and block references use them", async () => {
    const { host, get, metadata, labels } = setup({
      ...base,
      scripts: [
        {
          ...base.scripts[0]!,
          statements: [{ type: "switchCostume", costumeId: "asset:costume.default" }],
        },
      ],
    } as ProjectProgram);
    await host.handle({
      schema,
      type: "updateActor",
      actorId: "actor:main",
      patch: { costumeId: "costume:pip" },
    });
    expect(metadata().assets).toContainEqual(expect.objectContaining({ id: "costume:pip" }));
    await host.handle({ schema, type: "updateStage", backdropId: "backdrop:forest" });
    expect(metadata().assets).toContainEqual(expect.objectContaining({ id: "backdrop:forest" }));
    await host.handle({
      schema,
      type: "intent",
      intent: {
        type: "setTextField",
        location: { container: script, index: 0 },
        field: "costumeId",
        value: "costume:comet",
      },
      baseHash: programSemanticHash(get()!),
    });
    expect(get()!.scripts[0]?.statements[0]).toMatchObject({
      type: "switchCostume",
      costumeId: "costume:comet",
    });
    expect(metadata().assets).toContainEqual(expect.objectContaining({ id: "costume:comet" }));
    expect(labels).toEqual([
      "Workbench: update actor",
      "Workbench: update stage backdrop",
      "Workbench: setTextField",
    ]);
  });

  it("deletes an actor with its scripts atomically and refuses stale or referenced actors", async () => {
    const { host, get, metadata, port, labels } = setup();
    await host.handle({ schema, type: "createActor", name: "Robot" });
    const robot = metadata().actors!.items.find((actor) => actor.name === "Robot")!;
    const request = {
      schema,
      type: "deleteActor",
      actorId: robot.id,
      ownedScriptIds: robot.scripts!,
      baseHash: programSemanticHash(get()!),
    } as const;
    const before = labels.length;
    expect((await host.handle({ ...request, ownedScriptIds: [] }))[0]).toMatchObject({
      type: "error",
      code: "INVALID_CHANGE",
    });
    expect((await host.handle({ ...request, baseHash: "fnv1a32:00000000" }))[0]).toMatchObject({
      type: "error",
      code: "STALE_EDIT",
    });
    expect(labels).toHaveLength(before);
    const withReference = {
      ...get()!,
      scripts: get()!.scripts.map((script) =>
        script.id === "main"
          ? { ...script, statements: [{ type: "pointTowards" as const, actorId: robot.id }] }
          : script,
      ),
    };
    await port.commit(withReference, "test reference");
    const referencedRequest = { ...request, baseHash: programSemanticHash(get()!) };
    expect((await host.handle(referencedRequest))[0]).toMatchObject({
      type: "error",
      code: "INVALID_CHANGE",
    });
    expect(metadata().actors!.items).toHaveLength(2);
    await port.commit(
      { ...get()!, scripts: base.scripts.concat(get()!.scripts.slice(1)) },
      "test remove reference",
    );
    const accepted = await host.handle({ ...request, baseHash: programSemanticHash(get()!) });
    expect(accepted.find((message) => message.type === "workspace")).toBeDefined();
    expect(get()!.scripts.map((script) => script.id)).toEqual(["main"]);
    expect(metadata().actors!.items.map((actor) => actor.id)).not.toContain(robot.id);
    expect(metadata().stage?.actorOrder).not.toContain(robot.id);
    expect((await host.handle(request))[0]).toMatchObject({ type: "error", code: "STALE_EDIT" });
    expect(
      (
        await host.handle({
          ...request,
          actorId: metadata().actors!.items[0]!.id,
          ownedScriptIds: ["main"],
          baseHash: programSemanticHash(get()!),
        })
      )[0],
    ).toMatchObject({ type: "error", code: "INVALID_CHANGE" });
  });

  it("creates a message script for one actor and refuses stale or unknown targets", async () => {
    const { host, get, metadata, labels } = setup();
    await host.handle({ schema, type: "createActor", name: "Robot" });
    const robot = metadata().actors!.items.find((actor) => actor.name === "Robot")!;
    const baseHash = programSemanticHash(get()!);
    const accepted = await host.handle({
      schema,
      type: "createScript",
      actorId: robot.id,
      trigger: "onMessage",
      message: "go",
      baseHash,
    });
    const created = get()!.scripts.at(-1)!;
    expect(created.trigger).toEqual({ type: "onMessage", message: "go" });
    expect(metadata().actors!.items.find((actor) => actor.id === robot.id)?.scripts).toContain(
      created.id,
    );
    expect(metadata().actors!.items[0]?.scripts).not.toContain(created.id);
    expect(accepted.find((item) => item.type === "workspace")).toBeDefined();
    const before = labels.length;
    expect(
      (
        await host.handle({
          schema,
          type: "createScript",
          actorId: robot.id,
          trigger: "greenFlag",
          baseHash,
        })
      )[0],
    ).toMatchObject({ type: "error", code: "STALE_EDIT" });
    expect(
      (
        await host.handle({
          schema,
          type: "createScript",
          actorId: "actor:missing",
          trigger: "greenFlag",
          baseHash: programSemanticHash(get()!),
        })
      )[0],
    ).toMatchObject({ type: "error", code: "INVALID_CHANGE" });
    expect(labels).toHaveLength(before);
  });

  it("deletes an owned script atomically and rejects stale, foreign and final scripts", async () => {
    const { host, get, metadata, labels } = setup();
    await host.handle({ schema, type: "createActor", name: "Robot" });
    const robot = metadata().actors!.items.find((actor) => actor.name === "Robot")!;
    const robotScriptId = robot.scripts![0]!;
    const request = {
      schema,
      type: "deleteScript",
      actorId: robot.id,
      scriptId: robotScriptId,
      baseHash: programSemanticHash(get()!),
    } as const;
    const before = labels.length;
    expect((await host.handle({ ...request, scriptId: "main" }))[0]).toMatchObject({
      type: "error",
      code: "INVALID_CHANGE",
    });
    expect((await host.handle({ ...request, actorId: "actor:missing" }))[0]).toMatchObject({
      type: "error",
      code: "INVALID_CHANGE",
    });
    expect(labels).toHaveLength(before);
    const accepted = await host.handle(request);
    expect(get()!.scripts.map((script) => script.id)).toEqual(["main"]);
    expect(metadata().actors!.items.find((actor) => actor.id === robot.id)?.scripts).toEqual([]);
    expect(accepted.find((item) => item.type === "workspace")).toBeDefined();
    expect((await host.handle(request))[0]).toMatchObject({ type: "error", code: "STALE_EDIT" });
    expect(
      (
        await host.handle({
          ...request,
          actorId: metadata().actors!.items[0]!.id,
          scriptId: "main",
          baseHash: programSemanticHash(get()!),
        })
      )[0],
    ).toMatchObject({ type: "error", code: "INVALID_CHANGE" });
    expect(labels).toHaveLength(before + 1);
  });

  it("creates actor-owned key and click scripts with canonical triggers", async () => {
    const { host, get, metadata } = setup();
    await host.handle({ schema, type: "createActor", name: "Robot" });
    const robot = metadata().actors!.items.find((actor) => actor.name === "Robot")!;
    await host.handle({
      schema,
      type: "createScript",
      actorId: robot.id,
      trigger: "onKeyPressed",
      key: "ArrowRight",
      baseHash: programSemanticHash(get()!),
    });
    const keyScript = get()!.scripts.at(-1)!;
    expect(keyScript.trigger).toEqual({ type: "onKeyPressed", key: "ArrowRight" });
    await host.handle({
      schema,
      type: "createScript",
      actorId: robot.id,
      trigger: "onKeyPressed",
      key: "7",
      baseHash: programSemanticHash(get()!),
    });
    expect(get()!.scripts.at(-1)?.trigger).toEqual({ type: "onKeyPressed", key: "7" });
    await host.handle({
      schema,
      type: "createScript",
      actorId: robot.id,
      trigger: "onActorClicked",
      baseHash: programSemanticHash(get()!),
    });
    const clickScript = get()!.scripts.at(-1)!;
    expect(clickScript.trigger).toEqual({ type: "onActorClicked" });
    expect(metadata().actors!.items.find((actor) => actor.id === robot.id)?.scripts).toEqual(
      expect.arrayContaining([keyScript.id, clickScript.id]),
    );
  });

  it("persists a bounded image and refuses an invalid import without mutation", async () => {
    const { host, metadata, labels } = setup();
    const source = `data:image/png;base64,${btoa("\x89PNG\r\n\x1a\nimage")}`;
    const accepted = await host.handle({
      schema,
      type: "importAsset",
      kind: "costume",
      name: "Nova",
      source,
    });
    expect(metadata().assets).toEqual([
      expect.objectContaining({ kind: "costume", name: "Nova", source }),
    ]);
    expect(accepted.find((message) => message.type === "assets")).toMatchObject({
      assets: expect.arrayContaining([expect.objectContaining({ name: "Nova" })]),
    });
    expect(labels).toEqual(["Workbench: import asset"]);
    const refused = await host.handle({
      schema,
      type: "importAsset",
      kind: "costume",
      name: "Bad",
      source: "https://example.com/a.png",
    });
    expect(refused[0]).toMatchObject({ type: "error", code: "INVALID_CHANGE" });
    expect(labels).toHaveLength(1);
  });

  it("imports an embedded sound and refuses a remote sound without mutation", async () => {
    const { host, metadata, labels } = setup();
    const source =
      "data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQEAAACAAA==";
    await host.handle({ schema, type: "importAsset", kind: "sound", name: "Bell", source });
    expect(metadata().assets).toEqual([
      expect.objectContaining({ kind: "sound", name: "Bell", source }),
    ]);
    const before = structuredClone(metadata().assets);
    const refused = await host.handle({
      schema,
      type: "importAsset",
      kind: "sound",
      name: "Remote",
      source: "https://example.com/bell.wav",
    });
    expect(refused[0]).toMatchObject({ type: "error", code: "INVALID_CHANGE" });
    expect(metadata().assets).toEqual(before);
    expect(labels).toEqual(["Workbench: import asset"]);
  });

  it("edits a known costume in place and refuses unknown assets", async () => {
    const { host, metadata, labels } = setup();
    const first = `data:image/png;base64,${btoa("\x89PNG\r\n\x1a\none")}`;
    const second = `data:image/png;base64,${btoa("\x89PNG\r\n\x1a\ntwo")}`;
    const edit = (source: string) =>
      host.handle({
        schema,
        type: "updateAsset",
        assetId: "asset:costume.default",
        name: "Explorer edit",
        source,
      });
    await edit(first);
    expect(metadata().assets).toEqual([
      expect.objectContaining({ id: "asset:costume.default", source: first }),
    ]);
    const accepted = await edit(second);
    expect(metadata().assets).toHaveLength(1);
    expect(accepted.find((message) => message.type === "assets")).toMatchObject({
      assets: expect.arrayContaining([
        expect.objectContaining({ id: "asset:costume.default", source: second }),
      ]),
    });
    expect(
      (
        await host.handle({
          schema,
          type: "updateAsset",
          assetId: "asset:missing",
          name: "Forged",
          source: first,
        })
      )[0],
    ).toMatchObject({ type: "error", code: "INVALID_CHANGE" });
    expect(labels).toEqual(["Workbench: edit image asset", "Workbench: edit image asset"]);
  });

  it("selects only known costume and sound assets for visual blocks", async () => {
    const { host, get, labels } = setup();
    await host.handle({
      schema,
      type: "intent",
      intent: {
        type: "insertBlock",
        blockType: "looks_switch_costume",
        to: { container: script, index: 0 },
      },
      baseHash: programSemanticHash(base),
    });
    const before = get()!;
    const accepted = await host.handle({
      schema,
      type: "intent",
      intent: {
        type: "setTextField",
        location: { container: script, index: 0 },
        field: "costumeId",
        value: "asset:costume.spark",
      },
      baseHash: programSemanticHash(before),
    });
    expect(accepted[0]).toMatchObject({ type: "workspace" });
    expect(get()?.scripts[0]?.statements[0]).toMatchObject({
      type: "switchCostume",
      costumeId: "asset:costume.spark",
    });
    const refused = await host.handle({
      schema,
      type: "intent",
      intent: {
        type: "setTextField",
        location: { container: script, index: 0 },
        field: "costumeId",
        value: "https://example.com/image.png",
      },
      baseHash: programSemanticHash(get()!),
    });
    expect(refused[0]).toMatchObject({ type: "error", code: "INVALID_CHANGE" });
    expect(labels).toHaveLength(2);
  });

  it("moves exactly like applying the same change through block-editor", async () => {
    const { host, get } = setup();
    const from = { container: script, index: 0 };
    const to = { container: script, index: 1 };
    await host.handle({
      schema,
      type: "intent",
      intent: { type: "moveBlock", from, to },
      baseHash: programSemanticHash(base),
    });
    const direct = applyWorkspaceChange(programToWorkspace(base).workspace, {
      type: "moveBlock",
      from,
      to,
    }).program;
    expect(programSemanticHash(get()!)).toBe(programSemanticHash(direct));
  });

  it("rejects invalid changes without committing", async () => {
    const { host, labels } = setup();
    const bad = await host.handle({
      schema,
      type: "intent",
      intent: {
        type: "insertBlock",
        blockType: "event_on_start",
        to: { container: script, index: 0 },
      },
      baseHash: programSemanticHash(base),
    });
    const outOfRange = await host.handle({
      schema,
      type: "intent",
      intent: {
        type: "moveBlock",
        from: { container: script, index: 9 },
        to: { container: script, index: 0 },
      },
      baseHash: programSemanticHash(base),
    });
    expect(bad).toEqual([
      { schema, type: "error", code: "INVALID_CHANGE", reason: "NOT_A_STATEMENT" },
    ]);
    expect(outOfRange).toEqual([
      { schema, type: "error", code: "INVALID_CHANGE", reason: "BLOCK_NOT_FOUND" },
    ]);
    expect(labels).toHaveLength(0);
  });

  it("routes non-mutating intents and never commits on proposal decisions", async () => {
    const { host, port, labels } = setup();
    await host.handle({ schema, type: "intent", intent: { type: "revealNode", nodeId: "n" } });
    await host.handle({
      schema,
      type: "intent",
      intent: { type: "reviewProposal", proposalId: "p" },
    });
    expect(port.reveal).toHaveBeenCalledWith("n");
    expect(port.openProposalReview).toHaveBeenCalledWith("p");
    expect(
      await host.handle({
        schema,
        type: "intent",
        intent: { type: "askAgent", verb: "explain", about: { kind: "node", id: "n" } },
      }),
    ).toEqual([]);
    expect(port.askAgent).toHaveBeenCalledWith("explain", "n");
    expect(
      await host.handle({ schema, type: "decideProposal", proposalId: "p", decision: "accepted" }),
    ).toEqual([]);
    expect(
      await host.handle({
        schema,
        type: "intent",
        intent: { type: "highlightNodes", nodeIds: ["n"] },
      }),
    ).toEqual([]);
    expect(port.reveal).toHaveBeenCalledWith("n");
    expect(labels).toHaveLength(0);
  });

  it("resolves Workbench block ids to canonical node ids for agent and reveal sync", async () => {
    const { host, port } = setup();
    const { workspace } = programToWorkspace(base);
    const blockId = workspace.scripts[0]?.statements[0]?.id;
    expect(blockId).toBeDefined();

    await host.handle({
      schema,
      type: "intent",
      intent: { type: "revealNode", nodeId: blockId! },
    });
    await host.handle({
      schema,
      type: "intent",
      intent: { type: "highlightNodes", nodeIds: [blockId!] },
    });
    await host.handle({
      schema,
      type: "intent",
      intent: { type: "askAgent", verb: "debug", about: { kind: "node", id: blockId! } },
    });

    expect(port.reveal).toHaveBeenCalledWith("scripts[0]/statements[0]");
    expect(port.askAgent).toHaveBeenCalledWith("debug", "scripts[0]/statements[0]");
  });

  it("stores Workbench agent agreements through the host port", async () => {
    const { host, port } = setup();
    const agreements = {
      ...DEFAULT_AGREEMENTS,
      aiEnabled: false,
      proactive: { ...DEFAULT_AGREEMENTS.proactive, stalled: false },
    };

    expect(await host.handle({ schema, type: "agreementsChanged", agreements })).toEqual([]);
    expect(port.updateAgreements).toHaveBeenCalledWith(agreements);
  });

  it("persists actor patches with canonical costume refs", async () => {
    const { host, metadata } = setup();
    await host.handle({
      schema,
      type: "updateActor",
      actorId: "actor:main",
      patch: { x: 24, costumeId: "asset:costume.default" },
    });
    expect(metadata().actors).toMatchObject({
      activeId: "actor:main",
      items: [{ id: "actor:main", x: 24, costumeId: "asset:costume.default" }],
    });
    expect(metadata().actors?.items[0]).not.toHaveProperty("scriptCount");
  });

  it("rejects actor patches for unknown actors or costumes", async () => {
    const { host, metadata, labels } = setup();

    await expect(
      host.handle({
        schema,
        type: "updateActor",
        actorId: "actor:missing",
        patch: { x: 24 },
      }),
    ).resolves.toEqual([
      { schema, type: "error", code: "INVALID_CHANGE", reason: "BLOCK_NOT_FOUND" },
    ]);
    expect(metadata().actors).toBeUndefined();
    expect(labels).toEqual([]);

    await expect(
      host.handle({
        schema,
        type: "updateActor",
        actorId: "actor:main",
        patch: { costumeId: "asset:costume.missing" },
      }),
    ).resolves.toEqual([
      { schema, type: "error", code: "INVALID_CHANGE", reason: "WOULD_BREAK_PROGRAM" },
    ]);
    expect(metadata().actors).toBeUndefined();
    expect(labels).toEqual([]);
  });

  it("reports broken actor, stage and asset references as Studio validation issues", async () => {
    const { host, metadata } = setup();
    const editableMetadata = metadata() as unknown as {
      actors?: ProjectMetadata["actors"];
      stage?: ProjectMetadata["stage"];
    };
    editableMetadata.actors = {
      activeId: "actor:main",
      items: [
        {
          id: "actor:main",
          name: "Explorer",
          x: 0,
          y: 0,
          direction: 0,
          size: 100,
          visible: true,
          costumeId: "asset:costume.missing",
        },
      ],
    };
    editableMetadata.stage = {
      actorOrder: ["actor:main", "actor:missing"],
      backdropId: "asset:space.missing",
    };

    expect(await host.handle({ schema, type: "ready" })).toContainEqual({
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
        {
          id: "validation:stage-actor:actor:missing:1",
          severity: "error",
          kind: "missing-actor",
          path: "metadata.stage.actorOrder[1]",
          ref: "actor:missing",
          message: 'Stage order references missing actor "actor:missing".',
        },
        {
          id: "validation:stage-backdrop:asset:space.missing",
          severity: "error",
          kind: "missing-backdrop",
          path: "metadata.stage.backdropId",
          ref: "asset:space.missing",
          message: 'Stage references missing backdrop "asset:space.missing".',
        },
      ],
    });
  });

  it("anchors ambient hints to Workbench blocks when the signal names a canonical node", () => {
    const { host } = setup();
    const { mapping } = programToWorkspace(base);
    const entry = mapping.find((m) => m.kind === "statement")!;
    const signal = createStudioSignal("runtime-error", 1, {
      code: "E_LOOP",
      nodeIds: [entry.nodeId],
    })!;

    expect(
      host.ambientHint(signal, {
        action: "offer",
        reason: "runtime-error-detected",
        generativeNeeded: "no",
        source: "system0",
        actions: ["debug", "explain"],
      }),
    ).toEqual([
      {
        schema,
        type: "ambientHint",
        hint: {
          label: "Companion can debug this with runtime evidence.",
          blockId: entry.blockId,
          actions: ["debug", "explain"],
        },
      },
    ]);
    expect(host.clearAmbientHint()).toEqual([{ schema, type: "ambientHint" }]);
  });
});

describe("syncMessage", () => {
  it("maps canonical hub ids to block ids", () => {
    const { host } = setup();
    const { mapping } = programToWorkspace(base);
    const entry = mapping.find((m) => m.kind === "statement")!;
    expect(
      host.syncMessage({ selectedNodeId: entry.nodeId, failedNodeId: "does/not/exist" }),
    ).toEqual([{ schema, type: "sync", selectedBlockId: entry.blockId }]);
  });

  it("returns no sync message without a program", () => {
    const { host } = setup(null);
    expect(host.syncMessage({ selectedNodeId: "x" })).toEqual([]);
  });
});

describe("stale edits", () => {
  const insert = {
    type: "insertBlock",
    blockType: "motion_move",
    to: { container: script, index: 0 },
  } as const;

  it("refuses a mutating intent whose baseHash is stale and resends a snapshot", async () => {
    const { host, labels } = setup();
    const out = await host.handle({ schema, type: "intent", intent: insert, baseHash: "old-hash" });
    expect(out[0]).toEqual({ schema, type: "error", code: "STALE_EDIT" });
    expect(out[1]).toMatchObject({ type: "workspace" });
    expect(labels).toHaveLength(0);
  });

  it("commits when the baseHash matches the current program", async () => {
    const { host, labels } = setup();
    await host.handle({
      schema,
      type: "intent",
      intent: insert,
      baseHash: programSemanticHash(base),
    });
    expect(labels).toHaveLength(1);
  });

  it("refuses a mutating intent without a baseHash", async () => {
    const { host, labels } = setup();
    const out = await host.handle({ schema, type: "intent", intent: insert });
    expect(out[0]).toEqual({ schema, type: "error", code: "STALE_EDIT" });
    expect(out[1]).toMatchObject({ type: "workspace" });
    expect(labels).toHaveLength(0);
  });

  it("still routes non-mutating intents with a stale baseHash", async () => {
    const { host, port } = setup();
    await host.handle({
      schema,
      type: "intent",
      intent: { type: "revealNode", nodeId: "scripts[0]/statements[0]" },
      baseHash: "old-hash",
    });
    expect(port.reveal).toHaveBeenCalled();
  });
});

describe("experience facts for the automatic density", () => {
  const insert = {
    type: "insertBlock",
    blockType: "motion_move",
    to: { container: script, index: 0 },
  } as const;

  it("counts only edits that were committed, never refused ones", async () => {
    const { host } = setup();
    expect(host.experience()).toEqual({ edits: 0, reachedGoal: false });
    await host.handle({
      schema,
      type: "intent",
      intent: insert,
      baseHash: programSemanticHash(base),
    });
    await host.handle({ schema, type: "intent", intent: insert, baseHash: "stale-hash" });
    await host.handle({
      schema,
      type: "intent",
      intent: {
        type: "insertBlock",
        blockType: "event_on_start",
        to: { container: script, index: 0 },
      },
      baseHash: programSemanticHash(base),
    });
    expect(host.experience().edits).toBe(1);
  });

  it("latches the goal fact so it never flips back", async () => {
    let reaches = false;
    const port = { ...setup().port, reachedGoal: () => reaches };
    const host = createWorkbenchHost(port, () => "block:x");
    expect(host.experience().reachedGoal).toBe(false);
    reaches = true;
    expect(host.experience().reachedGoal).toBe(true);
    reaches = false;
    expect(host.experience().reachedGoal).toBe(true);
  });
});
