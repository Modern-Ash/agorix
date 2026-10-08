import { describe, expect, it } from "vitest";
import { projectProgram } from "@agorix/code-generator";
import { validateProgram, type ProjectProgram } from "@agorix/program-model";
import {
  ACCESSIBILITY_LIMITATIONS,
  BlockEditorAdapterError,
  PACKAGE_NAME,
  POC_TOOLBOX,
  applyWorkspaceChange,
  canPlaceBlock,
  createDefaultBlock,
  createStarterWorkspace,
  getBlockDefinition,
  getCanonicalNodeIdForBlock,
  programToWorkspace,
  projectWorkspace,
  workspaceToProgram,
  type BlockScript,
  type BlockWorkspaceSnapshot,
} from "./index.js";

const FULL_COVERAGE_PROGRAM: ProjectProgram = {
  schema: "agorix/program/v1",
  scripts: [
    {
      id: "full-coverage",
      trigger: { type: "onStart" },
      statements: [
        { type: "move", steps: 3 },
        { type: "turn", degrees: 90 },
        { type: "repeat", count: 2, body: [{ type: "move", steps: 1 }] },
        {
          type: "if",
          condition: { type: "touchingGoal" },
          then: [{ type: "turn", degrees: -90 }],
        },
        {
          type: "if",
          condition: { type: "booleanLiteral", value: true },
          then: [{ type: "move", steps: 0 }],
        },
        {
          type: "if",
          condition: { type: "numericLiteral", value: 42 },
          then: [],
        },
      ],
    },
  ],
};

describe("block-editor", () => {
  it("exports a package identity", () => {
    expect(PACKAGE_NAME).toBe("@agorix/block-editor");
  });

  it("defines the minimal child-facing POC toolbox from the content guide", () => {
    expect(POC_TOOLBOX.map((section) => section.name)).toEqual([
      "Start",
      "Move",
      "Looks",
      "Sound",
      "Repeat & Decide",
      "Check",
      "Operators",
      "Variables",
    ]);
    expect(POC_TOOLBOX.flatMap((section) => section.blocks.map((block) => block.label))).toEqual([
      "When green flag clicked",
      "When key pressed",
      "When actor clicked",
      "When message received",
      "Broadcast message",
      "Move [N] steps",
      "Turn [N] degrees",
      "Say [text]",
      "Think [text]",
      "Show",
      "Hide",
      "Set size [N]",
      "Switch costume",
      "Switch backdrop",
      "Play sound",
      "Stop sounds",
      "Repeat [N] times",
      "If ___, then",
      "Touching the goal?",
      "[N] + [N]",
      "[N] - [N]",
      "[N] * [N]",
      "[N] / [N]",
      "[N] < [N]",
      "[N] > [N]",
      "[N] = [N]",
      "[A] and [B]",
      "[A] or [B]",
      "not [A]",
      "random [N] to [N]",
      "[N]",
      "true/false",
      "score",
      "Set score to [N]",
      "Change score by [N]",
      "Show score",
      "Hide score",
    ]);
    expect(POC_TOOLBOX.flatMap((section) => section.blocks)).toHaveLength(37);
  });

  it("creates safe defaults for every required POC block", () => {
    expect(createDefaultBlock("event_green_flag", "start")).toEqual({
      id: "start",
      type: "event_green_flag",
    });
    expect(createDefaultBlock("motion_move", "move")).toEqual({
      id: "move",
      type: "motion_move",
      fields: { steps: 10 },
    });
    expect(createDefaultBlock("motion_turn", "turn")).toEqual({
      id: "turn",
      type: "motion_turn",
      fields: { degrees: 90 },
    });
    expect(createDefaultBlock("looks_say", "say")).toEqual({
      id: "say",
      type: "looks_say",
      fields: { text: "Hello" },
    });
    expect(createDefaultBlock("looks_think", "think")).toEqual({
      id: "think",
      type: "looks_think",
      fields: { text: "Hmm" },
    });
    expect(createDefaultBlock("looks_show", "show")).toEqual({ id: "show", type: "looks_show" });
    expect(createDefaultBlock("looks_hide", "hide")).toEqual({ id: "hide", type: "looks_hide" });
    expect(createDefaultBlock("looks_set_size", "size")).toEqual({
      id: "size",
      type: "looks_set_size",
      fields: { size: 100 },
    });
    expect(createDefaultBlock("looks_switch_costume", "costume")).toEqual({
      id: "costume",
      type: "looks_switch_costume",
      fields: { costumeId: "asset:costume.default" },
    });
    expect(createDefaultBlock("looks_switch_backdrop", "backdrop")).toEqual({
      id: "backdrop",
      type: "looks_switch_backdrop",
      fields: { backdropId: "asset:space.trailhead" },
    });
    expect(createDefaultBlock("sound_play", "sound")).toEqual({
      id: "sound",
      type: "sound_play",
      fields: { soundId: "asset:sound.beacon" },
    });
    expect(createDefaultBlock("sound_stop", "stop")).toEqual({ id: "stop", type: "sound_stop" });
    expect(createDefaultBlock("control_repeat", "repeat")).toEqual({
      id: "repeat",
      type: "control_repeat",
      fields: { count: 3 },
      inputs: { body: [] },
    });
    expect(createDefaultBlock("control_if", "if")).toEqual({
      id: "if",
      type: "control_if",
      inputs: {
        condition: { id: "if:condition", type: "sensing_touching_goal" },
        then: [],
      },
    });
    expect(createDefaultBlock("sensing_touching_goal", "goal")).toEqual({
      id: "goal",
      type: "sensing_touching_goal",
    });
    expect(createDefaultBlock("event_on_key_pressed", "key")).toEqual({
      id: "key",
      type: "event_on_key_pressed",
      fields: { key: "Space" },
    });
    expect(createDefaultBlock("event_broadcast", "broadcast")).toEqual({
      id: "broadcast",
      type: "event_broadcast",
      fields: { message: "go" },
    });
    expect(createDefaultBlock("variables_change", "change")).toEqual({
      id: "change",
      type: "variables_change",
      fields: { variableId: "score" },
      inputs: { delta: { id: "change:delta", type: "literal_number", fields: { value: 1 } } },
    });
    expect(createDefaultBlock("operator_less_than", "less")).toEqual({
      id: "less",
      type: "operator_less_than",
      inputs: {
        left: { id: "less:left", type: "variables_value", fields: { variableId: "score" } },
        right: { id: "less:right", type: "literal_number", fields: { value: 10 } },
      },
    });
  });

  it("allows only valid visual block placements", () => {
    expect(canPlaceBlock("motion_move", "statement")).toBe(true);
    expect(canPlaceBlock("control_repeat", "statement")).toBe(true);
    expect(canPlaceBlock("sensing_touching_goal", "expression")).toBe(true);
    expect(canPlaceBlock("event_on_start", "trigger")).toBe(true);
    expect(canPlaceBlock("event_on_key_pressed", "trigger")).toBe(true);
    expect(canPlaceBlock("event_on_actor_clicked", "trigger")).toBe(true);
    expect(canPlaceBlock("event_on_message", "trigger")).toBe(true);
    expect(canPlaceBlock("event_broadcast", "statement")).toBe(true);
    expect(canPlaceBlock("sound_play", "statement")).toBe(true);
    expect(canPlaceBlock("sound_stop", "statement")).toBe(true);
    expect(canPlaceBlock("variables_change", "statement")).toBe(true);
    expect(canPlaceBlock("operator_less_than", "expression")).toBe(true);
    expect(canPlaceBlock("event_broadcast", "trigger")).toBe(false);
    expect(canPlaceBlock("sensing_touching_goal", "statement")).toBe(false);
    expect(canPlaceBlock("motion_move", "expression")).toBe(false);
  });

  it("documents POC accessibility limitations for block placement", () => {
    expect(ACCESSIBILITY_LIMITATIONS).toEqual([
      "Stock Blockly drag-and-drop block placement has no built-in keyboard-only alternative in the POC.",
      "The spatial block-composition canvas is not fully screen-reader navigable in stock Blockly.",
    ]);
  });

  it("round-trips canonical programs through blocks without semantic drift", () => {
    const { workspace, mapping } = programToWorkspace(FULL_COVERAGE_PROGRAM);
    const roundTripped = workspaceToProgram(workspace);

    expect(roundTripped.program).toEqual(validateProgram(FULL_COVERAGE_PROGRAM));
    expect(roundTripped.mapping.map((entry) => entry.nodeId)).toEqual(
      mapping.map((entry) => entry.nodeId),
    );
  });

  it("does not leak block ids or Blockly terms into the canonical program", () => {
    const workspace: BlockWorkspaceSnapshot = {
      scripts: [
        {
          id: "workspace-block-1",
          trigger: { id: "trigger-from-blockly", type: "event_on_start" },
          statements: [{ id: "blockly-move-id", type: "motion_move", fields: { steps: 5 } }],
        },
      ],
    };

    const { program } = workspaceToProgram(workspace);

    expect(program).toEqual({
      schema: "agorix/program/v1",
      scripts: [
        {
          id: "workspace-block-1",
          trigger: { type: "onStart" },
          statements: [{ type: "move", steps: 5 }],
        },
      ],
    });
    expect(JSON.stringify(program.scripts[0]?.statements)).not.toMatch(/block|blockly|workspace/i);
  });

  it("round-trips event triggers and broadcast blocks", () => {
    const program: ProjectProgram = {
      schema: "agorix/program/v1",
      scripts: [
        {
          id: "key",
          trigger: { type: "onKeyPressed", key: "Space" },
          statements: [{ type: "broadcast", message: "go" }],
        },
        {
          id: "click",
          trigger: { type: "onActorClicked" },
          statements: [{ type: "move", steps: 1 }],
        },
        {
          id: "message",
          trigger: { type: "onMessage", message: "go" },
          statements: [{ type: "turn", degrees: 15 }],
        },
      ],
    };

    const { workspace } = programToWorkspace(program);
    const roundTripped = workspaceToProgram(workspace);

    expect(workspace.scripts.map((script) => script.trigger)).toMatchObject([
      { type: "event_on_key_pressed", fields: { key: "Space" } },
      { type: "event_on_actor_clicked" },
      { type: "event_on_message", fields: { message: "go" } },
    ]);
    expect(workspace.scripts[0]?.statements[0]).toMatchObject({
      type: "event_broadcast",
      fields: { message: "go" },
    });
    expect(roundTripped.program).toEqual(validateProgram(program));
  });

  it("round-trips Looks and Sound blocks through the canonical model", () => {
    const program: ProjectProgram = {
      schema: "agorix/program/v1",
      scripts: [
        {
          id: "looks-and-sound",
          trigger: { type: "onStart" },
          statements: [
            { type: "say", text: "Go Nova" },
            { type: "think", text: "Need a plan" },
            { type: "hide" },
            { type: "show" },
            { type: "setSize", size: 120 },
            { type: "switchCostume", costumeId: "asset:costume.spark" },
            { type: "switchBackdrop", backdropId: "asset:space.nebula" },
            { type: "playSound", soundId: "asset:sound.beacon" },
            { type: "stopSounds" },
          ],
        },
      ],
    };

    const { workspace } = programToWorkspace(program);
    const roundTripped = workspaceToProgram(workspace);

    expect(workspace.scripts[0]?.statements.map((block) => block.type)).toEqual([
      "looks_say",
      "looks_think",
      "looks_hide",
      "looks_show",
      "looks_set_size",
      "looks_switch_costume",
      "looks_switch_backdrop",
      "sound_play",
      "sound_stop",
    ]);
    expect(workspace.scripts[0]?.statements[5]).toMatchObject({
      fields: { costumeId: "asset:costume.spark" },
    });
    expect(workspace.scripts[0]?.statements[6]).toMatchObject({
      fields: { backdropId: "asset:space.nebula" },
    });
    expect(workspace.scripts[0]?.statements[7]).toMatchObject({
      fields: { soundId: "asset:sound.beacon" },
    });
    expect(roundTripped.program).toEqual(validateProgram(program));
  });

  it("round-trips variables and operator expressions through blocks", () => {
    const program: ProjectProgram = {
      schema: "agorix/program/v1",
      variables: [{ id: "score", name: "score", initialValue: 0, visible: true }],
      scripts: [
        {
          id: "main",
          trigger: { type: "onStart" },
          statements: [
            {
              type: "changeVariable",
              variableId: "score",
              delta: {
                type: "add",
                left: { type: "variable", variableId: "score" },
                right: { type: "numericLiteral", value: 1 },
              },
            },
            {
              type: "if",
              condition: {
                type: "lessThan",
                left: { type: "variable", variableId: "score" },
                right: { type: "numericLiteral", value: 10 },
              },
              then: [{ type: "showVariable", variableId: "score" }],
            },
          ],
        },
      ],
    };

    const { workspace } = programToWorkspace(program);
    const roundTripped = workspaceToProgram(workspace);

    expect(workspace.variables).toEqual(program.variables);
    expect(workspace.scripts[0]?.statements[0]).toMatchObject({
      type: "variables_change",
      inputs: { delta: { type: "operator_add" } },
    });
    expect(roundTripped.program).toEqual(validateProgram(program));
  });

  it("creates the default score variable when adding a variable block", () => {
    const added = applyWorkspaceChange(createStarterWorkspace(), {
      type: "addBlock",
      container: { kind: "script", scriptIndex: 0 },
      index: 0,
      block: createDefaultBlock("variables_change", "change-1"),
    });

    expect(added.workspace.variables).toEqual([
      { id: "score", name: "score", initialValue: 0, visible: true },
    ]);
    expect(added.program.variables).toEqual(added.workspace.variables);
    expect(added.projection.code).toContain("score += 1;");
  });

  it("maps selected blocks to canonical node ids compatible with code highlighting", () => {
    const { workspace, mapping } = programToWorkspace(FULL_COVERAGE_PROGRAM);
    const moveBlockId = workspace.scripts[0]?.statements[0]?.id;
    expect(moveBlockId).toBeDefined();

    const nodeId = getCanonicalNodeIdForBlock(mapping, moveBlockId ?? "");
    const projection = projectProgram(FULL_COVERAGE_PROGRAM);

    expect(nodeId).toBe("scripts[0]/statements[0]");
    const highlighted = projection.mapping[nodeId ?? ""];
    expect(highlighted).toBeDefined();
    expect(projection.code.slice(highlighted?.start, highlighted?.end)).toBe("  sprite.move(3);\n");
  });

  it("keeps deterministic mapping for nested control blocks and expression inputs", () => {
    const program: ProjectProgram = {
      schema: "agorix/program/v1",
      scripts: [
        {
          id: "main",
          trigger: { type: "onStart" },
          statements: [
            {
              type: "repeat",
              count: 2,
              body: [
                {
                  type: "if",
                  condition: { type: "touchingGoal" },
                  then: [{ type: "turn", degrees: 90 }],
                },
              ],
            },
          ],
        },
      ],
    };

    const { mapping } = programToWorkspace(program);

    expect(mapping).toEqual([
      { blockId: "block:scripts_0_", kind: "script", nodeId: "scripts[0]" },
      { blockId: "block:scripts_0_trigger", kind: "trigger", nodeId: "scripts[0]/trigger" },
      {
        blockId: "block:scripts_0_statements_0_",
        kind: "statement",
        nodeId: "scripts[0]/statements[0]",
      },
      {
        blockId: "block:scripts_0_statements_0_body_0_",
        kind: "statement",
        nodeId: "scripts[0]/statements[0]/body[0]",
      },
      {
        blockId: "block:scripts_0_statements_0_body_0_condition",
        kind: "expression",
        nodeId: "scripts[0]/statements[0]/body[0]/condition",
      },
      {
        blockId: "block:scripts_0_statements_0_body_0_then_0_",
        kind: "statement",
        nodeId: "scripts[0]/statements[0]/body[0]/then[0]",
      },
    ]);
  });

  it("projects starter workspace changes to canonical program and code", () => {
    const starter = createStarterWorkspace();
    const added = applyWorkspaceChange(starter, {
      type: "addBlock",
      container: { kind: "script", scriptIndex: 0 },
      index: 0,
      block: createDefaultBlock("motion_move", "move-1"),
    });

    expect(starter.scripts[0]?.statements).toEqual([]);
    expect(added.program.scripts[0]?.statements).toEqual([{ type: "move", steps: 10 }]);
    expect(added.projection.code).toContain("sprite.move(10);");

    const edited = applyWorkspaceChange(added.workspace, {
      type: "editBlock",
      location: { container: { kind: "script", scriptIndex: 0 }, index: 0 },
      block: { id: "move-1", type: "motion_move", fields: { steps: 20 } },
    });

    expect(edited.program.scripts[0]?.statements).toEqual([{ type: "move", steps: 20 }]);
    expect(edited.projection.code).toContain("sprite.move(20);");
  });

  it("updates canonical projection for block add, move, edit and delete", () => {
    const workspace = createStarterWorkspace();
    const withMove = applyWorkspaceChange(workspace, {
      type: "addBlock",
      container: { kind: "script", scriptIndex: 0 },
      index: 0,
      block: createDefaultBlock("motion_move", "move-1"),
    });
    const withTurn = applyWorkspaceChange(withMove.workspace, {
      type: "addBlock",
      container: { kind: "script", scriptIndex: 0 },
      index: 1,
      block: createDefaultBlock("motion_turn", "turn-1"),
    });
    const moved = applyWorkspaceChange(withTurn.workspace, {
      type: "moveBlock",
      from: { container: { kind: "script", scriptIndex: 0 }, index: 1 },
      to: { container: { kind: "script", scriptIndex: 0 }, index: 0 },
    });
    const edited = applyWorkspaceChange(moved.workspace, {
      type: "editBlock",
      location: { container: { kind: "script", scriptIndex: 0 }, index: 0 },
      block: { id: "turn-1", type: "motion_turn", fields: { degrees: -90 } },
    });
    const deleted = applyWorkspaceChange(edited.workspace, {
      type: "deleteBlock",
      location: { container: { kind: "script", scriptIndex: 0 }, index: 1 },
    });

    expect(moved.projection.code.indexOf("sprite.turn(90);")).toBeLessThan(
      moved.projection.code.indexOf("sprite.move(10);"),
    );
    expect(edited.projection.code).toContain("sprite.turn(-90);");
    expect(deleted.program.scripts[0]?.statements).toEqual([{ type: "turn", degrees: -90 }]);
  });

  it("composes every required block through the adapter", () => {
    const workspace = createStarterWorkspace("compose-all");
    const repeat = createDefaultBlock("control_repeat", "repeat-1");
    const ifBlock = createDefaultBlock("control_if", "if-1");
    const baseScript = workspace.scripts[0];
    expect(baseScript).toBeDefined();
    const script: BlockScript = {
      id: baseScript?.id ?? "block:scripts_0_",
      ...(baseScript?.programId === undefined ? {} : { programId: baseScript.programId }),
      trigger: baseScript?.trigger ?? createDefaultBlock("event_on_start", "trigger"),
      statements: [
        createDefaultBlock("motion_move", "move-1"),
        createDefaultBlock("motion_turn", "turn-1"),
        { ...repeat, inputs: { body: [createDefaultBlock("motion_move", "move-2")] } },
        {
          ...ifBlock,
          inputs: { ...ifBlock.inputs, then: [createDefaultBlock("motion_turn", "turn-2")] },
        },
      ],
    };
    const composed: BlockWorkspaceSnapshot = { ...workspace, scripts: [script] };

    const update = projectWorkspace(composed);

    expect(update.program.scripts[0]?.statements).toHaveLength(4);
    expect(update.projection.code).toContain("repeat(3");
    expect(update.projection.code).toContain("if (sprite.touchingGoal())");
  });

  it("handles invalid visual combinations with structured errors", () => {
    expect(() =>
      applyWorkspaceChange(createStarterWorkspace(), {
        type: "addBlock",
        container: { kind: "script", scriptIndex: 0 },
        index: 0,
        block: createDefaultBlock("sensing_touching_goal", "goal"),
      }),
    ).toThrow(BlockEditorAdapterError);
  });

  it("explains why a placement is illegal with a reason", () => {
    const reasonOf = (change: Parameters<typeof applyWorkspaceChange>[1]) => {
      try {
        applyWorkspaceChange(createStarterWorkspace(), change);
      } catch (error) {
        return error instanceof BlockEditorAdapterError ? error.reason : "not-adapter-error";
      }
      return "no-error";
    };
    const script = { kind: "script", scriptIndex: 0 } as const;
    expect(
      reasonOf({
        type: "addBlock",
        container: script,
        index: 0,
        block: createDefaultBlock("sensing_touching_goal", "g"),
      }),
    ).toBe("NOT_A_STATEMENT");
    expect(
      reasonOf({
        type: "addBlock",
        container: script,
        index: 99,
        block: createDefaultBlock("motion_move", "m"),
      }),
    ).toBe("BAD_INDEX");
    expect(reasonOf({ type: "deleteBlock", location: { container: script, index: 5 } })).toBe(
      "BLOCK_NOT_FOUND",
    );
    expect(
      reasonOf({
        type: "addBlock",
        container: { kind: "repeatBody", scriptIndex: 0, statementPath: [0] },
        index: 0,
        block: createDefaultBlock("motion_move", "m"),
      }),
    ).toBe("BLOCK_NOT_FOUND");
  });

  it("returns structured adapter errors for malformed workspaces", () => {
    const workspace: BlockWorkspaceSnapshot = {
      scripts: [
        {
          id: "main",
          trigger: { id: "trigger", type: "event_on_start" },
          statements: [{ id: "mystery", type: "unknown_block" as never }],
        },
      ],
    };

    expect(() => workspaceToProgram(workspace)).toThrow(BlockEditorAdapterError);
    try {
      workspaceToProgram(workspace);
    } catch (error) {
      expect(error).toMatchObject({
        code: "UNKNOWN_BLOCK_TYPE",
        path: "scripts[0].statements[0].type",
        value: "unknown_block",
      });
    }
  });

  it("rejects unsupported trigger blocks before producing a partial program", () => {
    const workspace: BlockWorkspaceSnapshot = {
      scripts: [
        {
          id: "main",
          trigger: { id: "bad-trigger", type: "motion_move" },
          statements: [],
        },
      ],
    };

    expect(() => workspaceToProgram(workspace)).toThrowError(/UNSUPPORTED_TRIGGER/);
  });
});

describe("green-flag hat in the block editor", () => {
  const flagProgram = (type: "greenFlag" | "onStart"): ProjectProgram => ({
    schema: "agorix/program/v1",
    scripts: [{ id: "main", trigger: { type }, statements: [{ type: "move", steps: 10 }] }],
  });

  it("starts new workspaces with the green flag and converts it back to a green-flag trigger", () => {
    const starter = createStarterWorkspace();
    expect(starter.scripts[0]?.trigger.type).toBe("event_green_flag");
    expect(workspaceToProgram(starter).program.scripts[0]?.trigger).toEqual({ type: "greenFlag" });
  });

  it("round-trips green-flag and legacy programs without changing them", () => {
    for (const type of ["greenFlag", "onStart"] as const) {
      const program = flagProgram(type);
      const { workspace } = programToWorkspace(program);
      expect(workspace.scripts[0]?.trigger.type).toBe(
        type === "greenFlag" ? "event_green_flag" : "event_on_start",
      );
      expect(workspaceToProgram(workspace).program).toEqual(program);
    }
  });

  it("offers green-flag event blocks and still knows the legacy one", () => {
    const hats = POC_TOOLBOX.flatMap((section) => section.blocks).filter(
      (block) => block.placement === "trigger",
    );
    expect(hats.map((block) => block.label)).toEqual([
      "When green flag clicked",
      "When key pressed",
      "When actor clicked",
      "When message received",
    ]);
    expect(getBlockDefinition("event_on_start")?.legacy).toBe(true);
    expect(canPlaceBlock("event_green_flag", "trigger")).toBe(true);
  });
});
