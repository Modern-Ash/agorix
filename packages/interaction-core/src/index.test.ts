import { describe, expect, it } from "vitest";
import {
  BlockEditorAdapterError,
  applyWorkspaceChange,
  createStarterWorkspace,
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

  it("creates named variables and edits only valid numeric variable inputs", () => {
    const empty = createStarterWorkspace();
    const added = intentToChange({ type: "addVariable", name: "energy" }, newId, empty);
    const declared = applyWorkspaceChange(empty, added!).workspace;
    expect(declared.variables?.[0]).toMatchObject({ name: "energy", initialValue: 0 });
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
    expect(declared.lists![0]).toMatchObject({ name: "items", initialItems: [] });
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
