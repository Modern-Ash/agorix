import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION } from "@agorix/program-model";
import { applyWorkspaceChange, programToWorkspace } from "./index.js";

describe("declaration controls", () => {
  const workspace = programToWorkspace({
    schema: SCHEMA_VERSION,
    variables: [{ id: "score", name: "Score", initialValue: 0, visible: true }],
    lists: [{ id: "items", name: "Items", initialItems: [1], visible: true }],
    scripts: [],
  }).workspace;

  it("persists initial values and watcher visibility without changing declarations", () => {
    const seeded = applyWorkspaceChange(workspace, {
      type: "editVariableInitialValue",
      variableId: "score",
      value: 7,
    });
    const hiddenVariable = applyWorkspaceChange(seeded.workspace, {
      type: "editVariableVisibility",
      variableId: "score",
      visible: false,
    });
    const hiddenList = applyWorkspaceChange(hiddenVariable.workspace, {
      type: "editListVisibility",
      listId: "items",
      visible: false,
    });
    expect(hiddenList.program.variables?.[0]).toMatchObject({
      id: "score",
      initialValue: 7,
      visible: false,
    });
    expect(hiddenList.program.lists?.[0]).toMatchObject({
      id: "items",
      initialItems: [1],
      visible: false,
    });
    expect(workspace.variables?.[0]?.visible).toBe(true);
  });

  it("rejects missing declarations and out-of-range values", () => {
    expect(() =>
      applyWorkspaceChange(workspace, {
        type: "editVariableInitialValue",
        variableId: "missing",
        value: 1,
      }),
    ).toThrow();
    expect(() =>
      applyWorkspaceChange(workspace, {
        type: "editVariableVisibility",
        variableId: "missing",
        visible: false,
      }),
    ).toThrow();
    expect(() =>
      applyWorkspaceChange(workspace, {
        type: "editListVisibility",
        listId: "missing",
        visible: false,
      }),
    ).toThrow();
    expect(() =>
      applyWorkspaceChange(workspace, {
        type: "editVariableInitialValue",
        variableId: "score",
        value: 1_000_001,
      }),
    ).toThrow();
  });
});
