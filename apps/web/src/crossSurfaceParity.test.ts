/**
 * Web and Studio must edit the program identically. Both paths end in block-editor's
 * applyWorkspaceChange; this test pins that the Web helpers (including the drop-slot to
 * final-index translation) and the shared interaction-core intents give the same hash.
 * Convention: core intents index moves AFTER removal (final index); Web drop slots are numbered
 * BEFORE removal and go through finalMoveIndex.
 */
import { describe, expect, it } from "vitest";
import { applyWorkspaceChange, programToWorkspace } from "@agorix/block-editor";
import { intentToChange, keyboardIntent, type Intent } from "@agorix/interaction-core";
import { programSemanticHash } from "@agorix/proposals";
import type { ProjectProgram } from "@agorix/program-model";
import {
  addBlockToWorkspaceAt,
  createEditorModelFromProgram,
  deleteBlockFromWorkspaceAt,
  finalMoveIndex,
  moveBlockInWorkspaceByPath,
} from "./editorModel.js";

const script = { kind: "script", scriptIndex: 0 } as const;
const three = {
  schema: "agorix/program/v1",
  scripts: [
    {
      id: "main",
      trigger: { type: "onStart" },
      statements: [
        { type: "move", steps: 1 },
        { type: "turn", degrees: 90 },
        { type: "move", steps: 3 },
      ],
    },
  ],
} as unknown as ProjectProgram;
const empty = {
  schema: "agorix/program/v1",
  scripts: [{ id: "main", trigger: { type: "onStart" }, statements: [] }],
} as unknown as ProjectProgram;

const hash = (program: ProjectProgram) => programSemanticHash(program);

function core(program: ProjectProgram, ...intents: Intent[]): ProjectProgram {
  let workspace = programToWorkspace(program).workspace;
  let n = 0;
  let last = program;
  for (const intent of intents) {
    const change = intentToChange(intent, () => `block:p_${(n += 1)}`);
    if (change === undefined) throw new Error("expected a mutating intent");
    const update = applyWorkspaceChange(workspace, change);
    workspace = update.workspace;
    last = update.program;
  }
  return last;
}

function web(program: ProjectProgram) {
  return createEditorModelFromProgram(program);
}

describe("cross-surface parity", () => {
  it("inserts at the end and at index 0", () => {
    const viaWeb = addBlockToWorkspaceAt(web(empty).workspace, "motion_move", [], 0);
    const viaCore = core(empty, {
      type: "insertBlock",
      blockType: "motion_move",
      to: { container: script, index: 0 },
    });
    expect(hash(viaWeb.program)).toBe(hash(viaCore));
    const viaWeb2 = addBlockToWorkspaceAt(web(three).workspace, "motion_turn", [], 0);
    const viaCore2 = core(three, {
      type: "insertBlock",
      blockType: "motion_turn",
      to: { container: script, index: 0 },
    });
    expect(hash(viaWeb2.program)).toBe(hash(viaCore2));
  });

  it("inserts inside a repeat body", () => {
    const withRepeat = addBlockToWorkspaceAt(web(empty).workspace, "control_repeat", [], 0);
    const viaWeb = addBlockToWorkspaceAt(withRepeat.workspace, "motion_move", [0], 0);
    const viaCore = core(
      empty,
      { type: "insertBlock", blockType: "control_repeat", to: { container: script, index: 0 } },
      {
        type: "insertBlock",
        blockType: "motion_move",
        to: { container: { kind: "repeatBody", scriptIndex: 0, statementPath: [0] }, index: 0 },
      },
    );
    expect(hash(viaWeb.program)).toBe(hash(viaCore));
  });

  it("moves to the end, to the front, and deletes the middle block", () => {
    const toEnd = moveBlockInWorkspaceByPath(web(three).workspace, [0], [], 2);
    const coreEnd = core(three, {
      type: "moveBlock",
      from: { container: script, index: 0 },
      to: { container: script, index: 2 },
    });
    expect(hash(toEnd.program)).toBe(hash(coreEnd));
    const toFront = moveBlockInWorkspaceByPath(web(three).workspace, [1], [], 0);
    const coreFront = core(three, {
      type: "moveBlock",
      from: { container: script, index: 1 },
      to: { container: script, index: 0 },
    });
    expect(hash(toFront.program)).toBe(hash(coreFront));
    const del = deleteBlockFromWorkspaceAt(web(three).workspace, [1]);
    const coreDel = core(three, {
      type: "deleteBlock",
      location: { container: script, index: 1 },
    });
    expect(hash(del.program)).toBe(hash(coreDel));
  });

  it("translates drop slots like Studio: the slot next to the source is a no-op", () => {
    expect(finalMoveIndex([0], [], 0)).toBe(0);
    expect(finalMoveIndex([0], [], 1)).toBe(0);
    expect(finalMoveIndex([0], [], 2)).toBe(1);
    expect(finalMoveIndex([2], [], 0)).toBe(0);
    expect(finalMoveIndex([0], [1], 2)).toBe(2);
    const viaWeb = moveBlockInWorkspaceByPath(
      web(three).workspace,
      [1],
      [],
      finalMoveIndex([1], [], 2),
    );
    expect(hash(viaWeb.program)).toBe(hash(three));
  });

  it("keyboard Down equals the Web Down button", () => {
    const intent = keyboardIntent("Alt+ArrowDown", {
      location: { container: script, index: 0 },
      siblingCount: 3,
    });
    if (intent === undefined) throw new Error("expected intent");
    const viaCore = core(three, intent);
    const viaWeb = moveBlockInWorkspaceByPath(web(three).workspace, [0], [], 1);
    expect(hash(viaWeb.program)).toBe(hash(viaCore));
  });
});
