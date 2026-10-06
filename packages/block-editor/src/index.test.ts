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
      "Repeat & Decide",
      "Check",
    ]);
    expect(POC_TOOLBOX.flatMap((section) => section.blocks.map((block) => block.label))).toEqual([
      "When green flag clicked",
      "Move [N] steps",
      "Turn [N] degrees",
      "Set x to [N]",
      "Set y to [N]",
      "Wait [N] seconds",
      "Repeat [N] times",
      "If ___, then",
      "Touching the goal?",
    ]);
    expect(POC_TOOLBOX.flatMap((section) => section.blocks)).toHaveLength(9);
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
  });

  it("allows only valid visual block placements", () => {
    expect(canPlaceBlock("motion_move", "statement")).toBe(true);
    expect(canPlaceBlock("control_repeat", "statement")).toBe(true);
    expect(canPlaceBlock("sensing_touching_goal", "expression")).toBe(true);
    expect(canPlaceBlock("event_on_start", "trigger")).toBe(true);
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

  it("offers one start block, the green flag, and still knows the legacy one", () => {
    const hats = POC_TOOLBOX.flatMap((section) => section.blocks).filter(
      (block) => block.placement === "trigger",
    );
    expect(hats.map((block) => block.label)).toEqual(["When green flag clicked"]);
    expect(getBlockDefinition("event_on_start")?.legacy).toBe(true);
    expect(canPlaceBlock("event_green_flag", "trigger")).toBe(true);
  });
});
