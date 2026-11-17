import { describe, expect, it } from "vitest";
import {
  BlockEditorAdapterError,
  applyWorkspaceChange,
  createStarterWorkspace,
  programToWorkspace,
  projectWorkspace,
} from "@agorix/block-editor";
import {
  createAnchorRef,
  intentToChange,
  keyboardIntent,
  parseAnchorRef,
  resolveDrop,
} from "./index.js";
import type { DropTarget } from "./index.js";

const script = { kind: "script", scriptIndex: 0 } as const;
const slot = (index: number): DropTarget => ({ kind: "slot", to: { container: script, index } });
let n = 0;
const newId = () => `block:t_${(n += 1)}`;

describe("interaction-core", () => {
  it("validates anchors", () => {
    expect(createAnchorRef("node", "node:a")).toEqual({ kind: "node", id: "node:a" });
    expect(() => createAnchorRef("node", "/etc/passwd")).toThrow(RangeError);
    expect(parseAnchorRef({ kind: "nope", id: "a" })).toBeUndefined();
  });

  it("never turns a proposal drop into anything but review", () => {
    const source = { kind: "proposal", proposalId: "prop:1" } as const;
    for (const target of [
      slot(0),
      { kind: "node", nodeId: "n" },
      { kind: "canvas" },
    ] as DropTarget[]) {
      expect(resolveDrop(source, target)).toEqual({ type: "reviewProposal", proposalId: "prop:1" });
    }
    expect(resolveDrop(source, { kind: "agent", verb: "explain" })).toBeUndefined();
  });

  it("returns undefined for invalid pairs and bad ids", () => {
    expect(
      resolveDrop({ kind: "palette", blockType: "motion_move" }, { kind: "canvas" }),
    ).toBeUndefined();
    expect(
      resolveDrop(
        { kind: "block", nodeId: "/x", location: { container: script, index: 0 } },
        { kind: "agent", verb: "debug" },
      ),
    ).toBeUndefined();
  });

  it("keyboard and drag resolve to the same change and respect list edges", () => {
    const location = { container: script, index: 1 };
    const key = keyboardIntent("Alt+ArrowDown", { location, siblingCount: 3 });
    const drag = resolveDrop({ kind: "block", nodeId: "n", location }, slot(2));
    expect(key).toEqual(drag);
    expect(
      keyboardIntent("Alt+ArrowUp", { location: { container: script, index: 0 }, siblingCount: 3 }),
    ).toBeUndefined();
    expect(
      keyboardIntent("Alt+ArrowDown", {
        location: { container: script, index: 2 },
        siblingCount: 3,
      }),
    ).toBeUndefined();
  });

  it("applies inserts canonically and surfaces block-editor errors for non-statements", () => {
    const ok = intentToChange(
      { type: "insertBlock", blockType: "motion_move", to: { container: script, index: 0 } },
      newId,
    );
    const bad = intentToChange(
      { type: "insertBlock", blockType: "event_on_start", to: { container: script, index: 0 } },
      newId,
    );
    expect(
      applyWorkspaceChange(createStarterWorkspace(), ok!).program.scripts[0]?.statements,
    ).toHaveLength(1);
    expect(() => applyWorkspaceChange(createStarterWorkspace(), bad!)).toThrow(
      BlockEditorAdapterError,
    );
    expect(intentToChange({ type: "revealNode", nodeId: "n" }, newId)).toBeUndefined();
  });

  it("edits an existing numeric field through a canonical change and refuses unknown fields", () => {
    const workspace = createStarterWorkspace();
    const inserted = applyWorkspaceChange(workspace, {
      type: "addBlock",
      container: script,
      index: 0,
      block: { id: "move:1", type: "motion_move", fields: { steps: 10 } },
    }).workspace;
    const location = { container: script, index: 0 };
    const change = intentToChange(
      { type: "setNumericField", location, field: "steps", value: 24 },
      newId,
      inserted,
    );
    expect(
      applyWorkspaceChange(inserted, change!).workspace.scripts[0]?.statements[0]?.fields?.steps,
    ).toBe(24);
    expect(
      intentToChange(
        { type: "setNumericField", location, field: "missing", value: 1 },
        newId,
        inserted,
      ),
    ).toBeUndefined();
    expect(
      intentToChange(
        { type: "setNumericField", location, field: "steps", value: Infinity },
        newId,
        inserted,
      ),
    ).toBeUndefined();
  });

  it("inserts advanced motion and timing blocks with editable numeric fields", () => {
    const cases = [
      { blockType: "motion_go_to", field: "x", value: 80, type: "goTo" },
      { blockType: "motion_glide_to", field: "seconds", value: 2, type: "glideTo" },
      { blockType: "motion_bounce_on_edge", field: undefined, value: 0, type: "bounceOnEdge" },
      { blockType: "control_wait", field: "seconds", value: 0.5, type: "wait" },
      { blockType: "looks_change_size", field: "delta", value: -20, type: "changeSize" },
    ] as const;
    let workspace = createStarterWorkspace();
    for (const [index, item] of cases.entries()) {
      const location = { container: script, index };
      const insertion = intentToChange(
        { type: "insertBlock", blockType: item.blockType, to: location },
        newId,
        workspace,
      );
      workspace = applyWorkspaceChange(workspace, insertion!).workspace;
      if (item.field !== undefined) {
        const edit = intentToChange(
          { type: "setNumericField", location, field: item.field, value: item.value },
          newId,
          workspace,
        );
        workspace = applyWorkspaceChange(workspace, edit!).workspace;
        expect(workspace.scripts[0]?.statements[index]?.fields?.[item.field]).toBe(item.value);
      }
    }
    expect(workspace.scripts[0]?.statements.map((block) => block.type)).toEqual(
      cases.map((item) => item.blockType),
    );
    expect(
      projectWorkspace(workspace).program.scripts[0]?.statements.map((statement) => statement.type),
    ).toEqual(cases.map((item) => item.type));
    expect(
      intentToChange(
        {
          type: "setNumericField",
          location: { container: script, index: 0 },
          field: "x",
          value: Infinity,
        },
        newId,
        workspace,
      ),
    ).toBeUndefined();
  });

  it("edits an existing text field without accepting a new field or oversized text", () => {
    const workspace = applyWorkspaceChange(createStarterWorkspace(), {
      type: "addBlock",
      container: script,
      index: 0,
      block: { id: "say:1", type: "looks_say", fields: { text: "Hello" } },
    }).workspace;
    const location = { container: script, index: 0 };
    const change = intentToChange(
      { type: "setTextField", location, field: "text", value: "Hola" },
      newId,
      workspace,
    );
    expect(
      applyWorkspaceChange(workspace, change!).workspace.scripts[0]?.statements[0]?.fields?.text,
    ).toBe("Hola");
    expect(
      intentToChange(
        { type: "setTextField", location, field: "missing", value: "x" },
        newId,
        workspace,
      ),
    ).toBeUndefined();
    expect(
      intentToChange(
        { type: "setTextField", location, field: "text", value: "x".repeat(161) },
        newId,
        workspace,
      ),
    ).toBeUndefined();
  });

  it("replaces only a boolean condition through a canonical workspace edit", () => {
    const workspace = applyWorkspaceChange(createStarterWorkspace(), {
      type: "addBlock",
      container: script,
      index: 0,
      block: {
        id: "if:1",
        type: "control_if",
        inputs: { condition: { id: "goal:1", type: "sensing_touching_goal" }, then: [] },
      },
    }).workspace;
    const location = { container: script, index: 0 };
    const change = intentToChange(
      { type: "replaceCondition", location, blockType: "literal_boolean" },
      newId,
      workspace,
    );
    expect(
      applyWorkspaceChange(workspace, change!).workspace.scripts[0]?.statements[0]?.inputs
        ?.condition,
    ).toMatchObject({
      type: "literal_boolean",
      fields: { value: true },
    });
    expect(
      intentToChange(
        { type: "replaceCondition", location, blockType: "operator_add" },
        newId,
        workspace,
      ),
    ).toBeUndefined();
    expect(
      intentToChange(
        {
          type: "replaceCondition",
          location: { container: script, index: 1 },
          blockType: "literal_boolean",
        },
        newId,
        workspace,
      ),
    ).toBeUndefined();
  });

  it("inserts repeat-until, edits its condition, and accepts nested statements canonically", () => {
    const starter = createStarterWorkspace();
    const insert = intentToChange(
      {
        type: "insertBlock",
        blockType: "control_repeat_until",
        to: { container: script, index: 0 },
      },
      newId,
      starter,
    );
    const workspace = applyWorkspaceChange(starter, insert!).workspace;
    const location = { container: script, index: 0 };
    const replace = intentToChange(
      { type: "replaceCondition", location, blockType: "literal_boolean" },
      newId,
      workspace,
    );
    const conditioned = applyWorkspaceChange(workspace, replace!).workspace;
    const body = { kind: "repeatUntilBody", scriptIndex: 0, statementPath: [0] } as const;
    const nested = intentToChange(
      { type: "insertBlock", blockType: "motion_move", to: { container: body, index: 0 } },
      newId,
      conditioned,
    );
    const result = applyWorkspaceChange(conditioned, nested!);
    expect(result.program.scripts[0]?.statements[0]).toMatchObject({
      type: "repeatUntil",
      condition: { type: "booleanLiteral", value: true },
      body: [{ type: "move", steps: 10 }],
    });
    expect(
      intentToChange(
        { type: "replaceCondition", location, blockType: "operator_add" },
        newId,
        conditioned,
      ),
    ).toBeUndefined();
    expect(() =>
      applyWorkspaceChange(conditioned, {
        type: "addBlock",
        container: { kind: "repeatBody", scriptIndex: 0, statementPath: [0] },
        index: 0,
        block: { id: "bad:body", type: "motion_move", fields: { steps: 1 } },
      }),
    ).toThrow(BlockEditorAdapterError);
  });

  it("edits an else branch and a nested statement without changing the then branch", () => {
    const base = applyWorkspaceChange(createStarterWorkspace(), {
      type: "addBlock",
      container: script,
      index: 0,
      block: {
        id: "if:else",
        type: "control_if",
        inputs: {
          condition: { id: "goal:else", type: "sensing_touching_goal" },
          then: [{ id: "then:move", type: "motion_move", fields: { steps: 1 } }],
        },
      },
    }).workspace;
    const elsePath = {
      kind: "ifElse",
      scriptIndex: 0,
      statementPath: [0],
      branchPath: ["else"],
    } as const;
    const addRepeat = intentToChange(
      { type: "insertBlock", blockType: "control_repeat", to: { container: elsePath, index: 0 } },
      newId,
      base,
    );
    const withRepeat = applyWorkspaceChange(base, addRepeat!).workspace;
    const repeatBody = {
      kind: "repeatBody",
      scriptIndex: 0,
      statementPath: [0, 0],
      branchPath: ["else", "body"],
    } as const;
    const addMove = intentToChange(
      { type: "insertBlock", blockType: "motion_move", to: { container: repeatBody, index: 0 } },
      newId,
      withRepeat,
    );
    const result = applyWorkspaceChange(withRepeat, addMove!).program.scripts[0]?.statements[0];
    expect(result).toMatchObject({
      type: "if",
      then: [{ type: "move", steps: 1 }],
      else: [{ type: "repeat", body: [{ type: "move", steps: 10 }] }],
    });
    expect(() =>
      applyWorkspaceChange(withRepeat, {
        type: "addBlock",
        container: { ...repeatBody, branchPath: ["then", "body"] },
        index: 0,
        block: { id: "invalid:move", type: "motion_move", fields: { steps: 1 } },
      }),
    ).toThrow(BlockEditorAdapterError);
  });

  it("builds a comparison with editable numeric operands and refuses invalid operand edits", () => {
    const workspace = applyWorkspaceChange(createStarterWorkspace(), {
      type: "addBlock",
      container: script,
      index: 0,
      block: {
        id: "if:compare",
        type: "control_if",
        inputs: { condition: { id: "goal:compare", type: "sensing_touching_goal" }, then: [] },
      },
    }).workspace;
    const location = { container: script, index: 0 };
    const replacement = intentToChange(
      { type: "replaceCondition", location, blockType: "operator_less_than" },
      newId,
      workspace,
    );
    const compared = applyWorkspaceChange(workspace, replacement!).workspace;
    expect(compared.scripts[0]?.statements[0]?.inputs?.condition).toMatchObject({
      type: "operator_less_than",
      inputs: {
        left: { type: "literal_number", fields: { value: 0 } },
        right: { type: "literal_number", fields: { value: 10 } },
      },
    });
    const changed = intentToChange(
      { type: "setConditionNumber", location, side: "left", value: 7 },
      newId,
      compared,
    );
    expect(
      applyWorkspaceChange(compared, changed!).program.scripts[0]?.statements[0],
    ).toMatchObject({
      type: "if",
      condition: { type: "lessThan", left: { type: "numericLiteral", value: 7 } },
    });
    expect(
      intentToChange(
        { type: "setConditionNumber", location, side: "left", value: Infinity },
        newId,
        compared,
      ),
    ).toBeUndefined();
    expect(
      intentToChange(
        {
          type: "setConditionNumber",
          location: { container: script, index: 1 },
          side: "left",
          value: 2,
        },
        newId,
        compared,
      ),
    ).toBeUndefined();
    expect(
      intentToChange(
        { type: "setConditionNumber", location, side: "left", value: 2 },
        newId,
        workspace,
      ),
    ).toBeUndefined();
  });
  it("selects declared and sensor sources for comparison operands", () => {
    const location = { container: script, index: 0 };
    const empty = createStarterWorkspace();
    const declared = applyWorkspaceChange(
      empty,
      intentToChange({ type: "addVariable", name: "score" }, newId, empty)!,
    ).workspace;
    const initial = applyWorkspaceChange(declared, {
      type: "addBlock",
      container: script,
      index: 0,
      block: {
        id: "if:sources",
        type: "control_if",
        inputs: {
          then: [],
          condition: { id: "c:sources", type: "literal_boolean", fields: { value: true } },
        },
      },
    }).workspace;
    for (const [blockType, type] of [
      ["operator_less_or_equal", "lessOrEqual"],
      ["operator_greater_or_equal", "greaterOrEqual"],
    ] as const) {
      const changed = applyWorkspaceChange(
        initial,
        intentToChange({ type: "replaceCondition", location, blockType }, newId, initial)!,
      ).workspace;
      const variable = applyWorkspaceChange(
        changed,
        intentToChange(
          {
            type: "setComparisonOperand",
            location,
            side: "left",
            source: "variable",
            referenceId: declared.variables![0]!.id,
          },
          newId,
          changed,
        )!,
      );
      expect(variable.program.scripts[0]?.statements[0]).toMatchObject({
        condition: { type, left: { type: "variable", variableId: declared.variables![0]!.id } },
      });
      const sensor = applyWorkspaceChange(
        variable.workspace,
        intentToChange(
          { type: "setComparisonOperand", location, side: "right", source: "xPosition" },
          newId,
          variable.workspace,
        )!,
      );
      expect(sensor.program.scripts[0]?.statements[0]).toMatchObject({
        condition: { type, right: { type: "xPosition" } },
      });
      expect(
        intentToChange(
          {
            type: "setComparisonOperand",
            location,
            side: "left",
            source: "variable",
            referenceId: "missing",
          },
          newId,
          changed,
        ),
      ).toBeUndefined();
      expect(
        intentToChange(
          { type: "setConditionNumber", location, side: "left", value: 3 },
          newId,
          variable.workspace,
        ),
      ).toBeUndefined();
    }
  });
  it("edits only Boolean literals and actor contact conditions", () => {
    const location = { container: script, index: 0 };
    const initial = applyWorkspaceChange(createStarterWorkspace(), {
      type: "addBlock",
      container: script,
      index: 0,
      block: {
        id: "if:one",
        type: "control_if",
        inputs: {
          condition: { id: "boolean:one", type: "literal_boolean", fields: { value: true } },
          then: [],
        },
      },
    }).workspace;
    const changed = intentToChange(
      { type: "setConditionBoolean", location, value: false },
      newId,
      initial,
    );
    expect(applyWorkspaceChange(initial, changed!).program.scripts[0]?.statements[0]).toMatchObject(
      { type: "if", condition: { type: "booleanLiteral", value: false } },
    );
    expect(
      intentToChange(
        { type: "setConditionActor", location, actorId: "actor:robot" },
        newId,
        initial,
      ),
    ).toBeUndefined();
    const actorCondition = applyWorkspaceChange(
      initial,
      intentToChange(
        { type: "replaceCondition", location, blockType: "sensing_touching_actor" },
        newId,
        initial,
      )!,
    ).workspace;
    const actorChange = intentToChange(
      { type: "setConditionActor", location, actorId: "actor:robot" },
      newId,
      actorCondition,
    );
    expect(
      applyWorkspaceChange(actorCondition, actorChange!).program.scripts[0]?.statements[0],
    ).toMatchObject({ type: "if", condition: { type: "touchingActor", actorId: "actor:robot" } });
    expect(
      intentToChange(
        { type: "setConditionActor", location, actorId: "https://bad" },
        newId,
        actorCondition,
      ),
    ).toBeUndefined();
  });

  it("builds logical conditions and edits only valid Boolean operands", () => {
    const location = { container: script, index: 0 };
    const initial = applyWorkspaceChange(createStarterWorkspace(), {
      type: "addBlock",
      container: script,
      index: 0,
      block: {
        id: "if:logic",
        type: "control_if",
        inputs: {
          condition: { id: "c:logic", type: "literal_boolean", fields: { value: true } },
          then: [],
        },
      },
    }).workspace;
    for (const [blockType, type] of [
      ["operator_and", "and"],
      ["operator_or", "or"],
      ["operator_not", "not"],
    ] as const) {
      const changed = applyWorkspaceChange(
        initial,
        intentToChange({ type: "replaceCondition", location, blockType }, newId, initial)!,
      ).workspace;
      const side = blockType === "operator_not" ? "value" : "right";
      const literal = applyWorkspaceChange(
        changed,
        intentToChange(
          { type: "setLogicalOperand", location, side, blockType: "literal_boolean" },
          newId,
          changed,
        )!,
      ).workspace;
      const toggled = applyWorkspaceChange(
        literal,
        intentToChange(
          { type: "setLogicalBoolean", location, side, value: false },
          newId,
          literal,
        )!,
      );
      expect(toggled.program.scripts[0]?.statements[0]).toMatchObject({
        condition: { type, [side]: { type: "booleanLiteral", value: false } },
      });
      expect(
        intentToChange(
          {
            type: "setLogicalBoolean",
            location,
            side: blockType === "operator_not" ? "left" : "value",
            value: false,
          },
          newId,
          changed,
        ),
      ).toBeUndefined();
      if (blockType === "operator_not")
        expect(
          intentToChange(
            { type: "setLogicalBoolean", location, side: "value", value: false },
            newId,
            changed,
          ),
        ).toBeUndefined();
    }
  });

  it("selects an actor inside a logical condition and rejects unsafe or mismatched edits", () => {
    const location = { container: script, index: 0 };
    const initial = applyWorkspaceChange(createStarterWorkspace(), {
      type: "addBlock",
      container: script,
      index: 0,
      block: {
        id: "if:actor-logic",
        type: "control_if",
        inputs: {
          condition: {
            id: "condition:actor-logic",
            type: "literal_boolean",
            fields: { value: true },
          },
          then: [],
        },
      },
    }).workspace;
    const logical = applyWorkspaceChange(
      initial,
      intentToChange(
        { type: "replaceCondition", location, blockType: "operator_and" },
        newId,
        initial,
      )!,
    ).workspace;
    const actor = applyWorkspaceChange(
      logical,
      intentToChange(
        {
          type: "setLogicalOperand",
          location,
          side: "right",
          blockType: "sensing_touching_actor",
          actorId: "actor:main",
        },
        newId,
        logical,
      )!,
    ).workspace;
    const selected = applyWorkspaceChange(
      actor,
      intentToChange(
        { type: "setLogicalActor", location, side: "right", actorId: "actor:robot" },
        newId,
        actor,
      )!,
    );
    expect(selected.program.scripts[0]?.statements[0]).toMatchObject({
      condition: { type: "and", right: { type: "touchingActor", actorId: "actor:robot" } },
    });
    expect(
      intentToChange(
        { type: "setLogicalActor", location, side: "right", actorId: "https://bad" },
        newId,
        actor,
      ),
    ).toBeUndefined();
    expect(
      intentToChange(
        { type: "setLogicalActor", location, side: "left", actorId: "actor:robot" },
        newId,
        actor,
      ),
    ).toBeUndefined();
  });
  it("creates named variables and edits only valid numeric variable inputs", () => {
    const empty = createStarterWorkspace();
    const added = intentToChange({ type: "addVariable", name: "energy" }, newId, empty);
    const declared = applyWorkspaceChange(empty, added!).workspace;
    const variableId = declared.variables![0]!.id;
    expect(
      intentToChange({ type: "setVariableInitialValue", variableId, value: 5 }, newId, declared),
    ).toMatchObject({ type: "editVariableInitialValue", variableId, value: 5 });
    expect(
      intentToChange({ type: "setVariableVisible", variableId, visible: false }, newId, declared),
    ).toMatchObject({ type: "editVariableVisibility", variableId, visible: false });
    expect(
      intentToChange(
        { type: "setVariableInitialValue", variableId, value: Infinity },
        newId,
        declared,
      ),
    ).toBeUndefined();
    expect(
      intentToChange(
        { type: "setVariableVisible", variableId: "missing", visible: false },
        newId,
        declared,
      ),
    ).toBeUndefined();
    expect(declared.variables?.[0]).toMatchObject({ name: "energy", initialValue: 0 });
    expect(
      applyWorkspaceChange(
        declared,
        intentToChange({ type: "renameVariable", variableId, name: "Power" }, newId, declared)!,
      ).program.variables?.[0],
    ).toMatchObject({ id: variableId, name: "Power" });
    expect(
      intentToChange(
        { type: "renameVariable", variableId: "missing", name: "Power" },
        newId,
        declared,
      ),
    ).toBeUndefined();
    expect(
      intentToChange({ type: "renameVariable", variableId, name: " " }, newId, declared),
    ).toBeUndefined();
    expect(
      applyWorkspaceChange(
        declared,
        intentToChange({ type: "deleteVariable", variableId }, newId, declared)!,
      ).program.variables,
    ).toEqual([]);
    expect(
      intentToChange({ type: "addVariable", name: "ENERGY" }, newId, declared),
    ).toBeUndefined();
    const withSet = applyWorkspaceChange(declared, {
      type: "addBlock",
      container: script,
      index: 0,
      block: {
        id: "set:energy",
        type: "variables_set",
        fields: { variableId: declared.variables![0]!.id },
        inputs: { value: { id: "number:energy", type: "literal_number", fields: { value: 0 } } },
      },
    }).workspace;
    const location = { container: script, index: 0 };
    const edit = intentToChange(
      { type: "setExpressionNumber", location, input: "value", value: 12 },
      newId,
      withSet,
    );
    expect(applyWorkspaceChange(withSet, edit!).program.scripts[0]?.statements[0]).toMatchObject({
      type: "setVariable",
      value: { type: "numericLiteral", value: 12 },
    });
    expect(
      intentToChange(
        { type: "setExpressionNumber", location, input: "delta", value: 2 },
        newId,
        withSet,
      ),
    ).toBeUndefined();
    expect(
      intentToChange(
        { type: "setExpressionNumber", location, input: "value", value: Infinity },
        newId,
        withSet,
      ),
    ).toBeUndefined();
  });
  it("creates lists and edits numeric list operands through canonical changes", () => {
    const empty = createStarterWorkspace();
    const declaration = intentToChange({ type: "addList", name: "items" }, newId, empty);
    const declared = applyWorkspaceChange(empty, declaration!).workspace;
    const listId = declared.lists![0]!.id;
    expect(
      intentToChange({ type: "setListVisible", listId, visible: false }, newId, declared),
    ).toMatchObject({ type: "editListVisibility", listId, visible: false });
    expect(
      intentToChange(
        { type: "setListVisible", listId: "missing", visible: false },
        newId,
        declared,
      ),
    ).toBeUndefined();
    const renamed = applyWorkspaceChange(
      declared,
      intentToChange({ type: "renameList", listId, name: "inventory" }, newId, declared)!,
    );
    expect(renamed.program.lists?.[0]).toMatchObject({ id: listId, name: "inventory" });
    expect(
      intentToChange({ type: "renameList", listId: "missing", name: "x" }, newId, declared),
    ).toBeUndefined();
    expect(
      intentToChange({ type: "renameList", listId, name: " " }, newId, declared),
    ).toBeUndefined();
    expect(
      applyWorkspaceChange(
        declared,
        intentToChange({ type: "deleteList", listId }, newId, declared)!,
      ).program.lists,
    ).toEqual([]);
    expect(declared.lists![0]).toMatchObject({ name: "items", initialItems: [] });
    const seeded = applyWorkspaceChange(
      declared,
      intentToChange({ type: "setListInitialItems", listId, items: [3, -2] }, newId, declared)!,
    );
    expect(seeded.program.lists?.[0]).toMatchObject({ id: listId, initialItems: [3, -2] });
    expect(
      intentToChange(
        { type: "setListInitialItems", listId: "missing", items: [1] },
        newId,
        declared,
      ),
    ).toBeUndefined();
    expect(
      intentToChange({ type: "setListInitialItems", listId, items: [Infinity] }, newId, declared),
    ).toBeUndefined();
    expect(
      intentToChange({ type: "setListInitialItems", listId, items: [1_000_001] }, newId, declared),
    ).toBeUndefined();
    expect(
      intentToChange(
        { type: "setListInitialItems", listId, items: Array(101).fill(0) },
        newId,
        declared,
      ),
    ).toBeUndefined();
    expect(intentToChange({ type: "addList", name: "ITEMS" }, newId, declared)).toBeUndefined();
    const inserted = intentToChange(
      { type: "insertBlock", blockType: "lists_insert_at", to: { container: script, index: 0 } },
      newId,
      declared,
    );
    const withBlock = applyWorkspaceChange(declared, inserted!).workspace;
    for (const blockType of [
      "lists_add",
      "lists_remove_at",
      "lists_insert_at",
      "lists_replace_at",
    ] as const) {
      const candidate = intentToChange(
        { type: "insertBlock", blockType, to: { container: script, index: 0 } },
        newId,
        declared,
      );
      expect(() => applyWorkspaceChange(declared, candidate!)).not.toThrow();
    }
    expect(withBlock.scripts[0]?.statements[0]?.fields?.listId).toBe(listId);
    const location = { container: script, index: 0 };
    const change = intentToChange(
      { type: "setExpressionNumber", location, input: "index", value: 2 },
      newId,
      withBlock,
    );
    expect(
      applyWorkspaceChange(withBlock, change!).program.scripts[0]?.statements[0],
    ).toMatchObject({ type: "listInsertAt", index: { type: "numericLiteral", value: 2 } });
    expect(
      intentToChange(
        { type: "insertBlock", blockType: "lists_add", to: { container: script, index: 0 } },
        newId,
        empty,
      ),
    ).toBeUndefined();
    expect(
      intentToChange(
        { type: "setExpressionNumber", location, input: "delta", value: 2 },
        newId,
        withBlock,
      ),
    ).toBeUndefined();
  });
  it("uses X, Y and actor distance sensors as numeric inputs", () => {
    const workspace = applyWorkspaceChange(createStarterWorkspace(), {
      type: "addBlock",
      container: script,
      index: 0,
      block: {
        id: "variable:sensor",
        type: "variables_set",
        fields: { variableId: "score" },
        inputs: { value: { id: "number:sensor", type: "literal_number", fields: { value: 0 } } },
      },
    }).workspace;
    const location = { container: script, index: 0 };
    for (const [reporter, type] of [
      ["xPosition", "xPosition"],
      ["yPosition", "yPosition"],
      ["distanceToActor", "distanceToActor"],
    ] as const) {
      const change = intentToChange(
        {
          type: "setNumericInput",
          location,
          input: "value",
          reporter,
          ...(reporter === "distanceToActor" ? { referenceId: "actor:robot" } : {}),
        },
        newId,
        workspace,
      );
      expect(
        applyWorkspaceChange(workspace, change!).program.scripts[0]?.statements[0],
      ).toMatchObject({ type: "setVariable", value: { type } });
    }
    expect(
      intentToChange(
        {
          type: "setNumericInput",
          location,
          input: "value",
          reporter: "distanceToActor",
          referenceId: "../bad",
        },
        newId,
        workspace,
      ),
    ).toBeUndefined();
  });
  it("inserts arithmetic sources and edits only their literal operands", () => {
    const workspace = applyWorkspaceChange(createStarterWorkspace(), {
      type: "addBlock",
      container: script,
      index: 0,
      block: {
        id: "var:math",
        type: "variables_set",
        fields: { variableId: "score" },
        inputs: { value: { id: "num:math", type: "literal_number", fields: { value: 0 } } },
      },
    }).workspace;
    const location = { container: script, index: 0 };
    for (const [reporter, type] of [
      ["add", "add"],
      ["subtract", "subtract"],
      ["multiply", "multiply"],
      ["divide", "divide"],
      ["modulo", "modulo"],
    ] as const) {
      const changed = applyWorkspaceChange(
        workspace,
        intentToChange(
          { type: "setNumericInput", location, input: "value", reporter },
          newId,
          workspace,
        )!,
      );
      expect(changed.program.scripts[0]?.statements[0]).toMatchObject({
        type: "setVariable",
        value: {
          type,
          left: { type: "numericLiteral", value: 0 },
          right: { type: "numericLiteral", value: 1 },
        },
      });
      const edited = applyWorkspaceChange(
        changed.workspace,
        intentToChange(
          { type: "setArithmeticOperand", location, input: "value", side: "left", value: 7 },
          newId,
          changed.workspace,
        )!,
      );
      expect(edited.program.scripts[0]?.statements[0]).toMatchObject({
        value: { left: { value: 7 }, right: { value: 1 } },
      });
      expect(
        intentToChange(
          {
            type: "setArithmeticOperand",
            location,
            input: "value",
            side: "right",
            value: Infinity,
          },
          newId,
          changed.workspace,
        ),
      ).toBeUndefined();
    }
    expect(
      intentToChange(
        { type: "setArithmeticOperand", location, input: "value", side: "left", value: 3 },
        newId,
        workspace,
      ),
    ).toBeUndefined();
    const mixed = programToWorkspace({
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
                left: { type: "variable", variableId: "score" },
                right: { type: "numericLiteral", value: 2 },
              },
            },
          ],
        },
      ],
    } as never).workspace;
    expect(
      intentToChange(
        { type: "setArithmeticOperand", location, input: "value", side: "left", value: 5 },
        newId,
        mixed,
      ),
    ).toBeUndefined();
    expect(
      intentToChange(
        { type: "setArithmeticOperand", location, input: "value", side: "right", value: 5 },
        newId,
        mixed,
      ),
    ).toBeDefined();
  });
  it("composes a second arithmetic level and edits its literal without replacing siblings", () => {
    let workspace = applyWorkspaceChange(createStarterWorkspace(), {
      type: "addBlock",
      container: script,
      index: 0,
      block: {
        id: "nested:set",
        type: "variables_set",
        fields: { variableId: "score" },
        inputs: { value: { id: "nested:value", type: "literal_number", fields: { value: 0 } } },
      },
    }).workspace;
    const location = { container: script, index: 0 };
    workspace = applyWorkspaceChange(
      workspace,
      intentToChange(
        { type: "setNumericInput", location, input: "value", reporter: "add" },
        newId,
        workspace,
      )!,
    ).workspace;
    workspace = applyWorkspaceChange(
      workspace,
      intentToChange(
        {
          type: "setArithmeticOperandSource",
          location,
          input: "value",
          side: "left",
          reporter: "multiply",
        },
        newId,
        workspace,
      )!,
    ).workspace;
    const changed = applyWorkspaceChange(
      workspace,
      intentToChange(
        {
          type: "setArithmeticOperand",
          location,
          input: "value",
          path: ["left"],
          side: "right",
          value: 6,
        },
        newId,
        workspace,
      )!,
    );
    expect(changed.program.scripts[0]?.statements[0]).toMatchObject({
      value: {
        type: "add",
        left: { type: "multiply", left: { value: 0 }, right: { value: 6 } },
        right: { value: 1 },
      },
    });
    expect(
      intentToChange(
        {
          type: "setArithmeticOperand",
          location,
          input: "value",
          path: ["right"],
          side: "left",
          value: 2,
        },
        newId,
        workspace,
      ),
    ).toBeUndefined();
    expect(
      intentToChange(
        {
          type: "setArithmeticOperand",
          location,
          input: "value",
          path: ["left", "right"],
          side: "left",
          value: 2,
        },
        newId,
        workspace,
      ),
    ).toBeUndefined();
  });
  it("creates bounded random reporters and edits only their literal range", () => {
    const workspace = applyWorkspaceChange(createStarterWorkspace(), {
      type: "addBlock",
      container: script,
      index: 0,
      block: {
        id: "random:set",
        type: "variables_set",
        fields: { variableId: "score" },
        inputs: { value: { id: "random:value", type: "literal_number", fields: { value: 0 } } },
      },
    }).workspace;
    const location = { container: script, index: 0 };
    for (const [reporter, type] of [
      ["random", "random"],
      ["randomInteger", "randomInteger"],
    ] as const) {
      const changed = applyWorkspaceChange(
        workspace,
        intentToChange(
          { type: "setNumericInput", location, input: "value", reporter },
          newId,
          workspace,
        )!,
      );
      expect(changed.program.scripts[0]?.statements[0]).toMatchObject({
        value: { type, min: { value: 1 }, max: { value: 10 } },
      });
      const edit = intentToChange(
        { type: "setArithmeticOperand", location, input: "value", side: "max", value: 20 },
        newId,
        changed.workspace,
      )!;
      expect(
        applyWorkspaceChange(changed.workspace, edit).program.scripts[0]?.statements[0],
      ).toMatchObject({
        value: { min: { value: 1 }, max: { value: 20 } },
      });
      expect(
        intentToChange(
          { type: "setArithmeticOperand", location, input: "value", side: "left", value: 2 },
          newId,
          changed.workspace,
        ),
      ).toBeUndefined();
    }
  });
  it("replaces numeric inputs with declared variable and list reporters", () => {
    let workspace = createStarterWorkspace();
    workspace = applyWorkspaceChange(
      workspace,
      intentToChange({ type: "addVariable", name: "score" }, newId, workspace)!,
    ).workspace;
    workspace = applyWorkspaceChange(
      workspace,
      intentToChange({ type: "addList", name: "items" }, newId, workspace)!,
    ).workspace;
    workspace = applyWorkspaceChange(
      workspace,
      intentToChange(
        { type: "insertBlock", blockType: "lists_add", to: { container: script, index: 0 } },
        newId,
        workspace,
      )!,
    ).workspace;
    const location = { container: script, index: 0 };
    const variableId = workspace.variables![0]!.id;
    const listId = workspace.lists![0]!.id;
    const variable = intentToChange(
      {
        type: "setNumericInput",
        location,
        input: "value",
        reporter: "variable",
        referenceId: variableId,
      },
      newId,
      workspace,
    );
    expect(
      applyWorkspaceChange(workspace, variable!).program.scripts[0]?.statements[0],
    ).toMatchObject({ type: "listAdd", value: { type: "variable", variableId } });
    const item = intentToChange(
      {
        type: "setNumericInput",
        location,
        input: "value",
        reporter: "listItem",
        referenceId: listId,
        itemIndex: 1,
      },
      newId,
      workspace,
    );
    expect(applyWorkspaceChange(workspace, item!).program.scripts[0]?.statements[0]).toMatchObject({
      type: "listAdd",
      value: { type: "listItem", listId, index: { type: "numericLiteral", value: 1 } },
    });
    expect(
      intentToChange(
        {
          type: "setNumericInput",
          location,
          input: "value",
          reporter: "variable",
          referenceId: "missing",
        },
        newId,
        workspace,
      ),
    ).toBeUndefined();
    expect(
      intentToChange(
        {
          type: "setNumericInput",
          location,
          input: "delta",
          reporter: "listLength",
          referenceId: listId,
        },
        newId,
        workspace,
      ),
    ).toBeUndefined();
  });
});
