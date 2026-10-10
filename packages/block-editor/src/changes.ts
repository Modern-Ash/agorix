import { projectProgram, type ProjectionResult } from "@agorix/code-generator";
import type { ProgramVariable } from "@agorix/program-model";
import {
  BlockEditorAdapterError,
  workspaceToProgram,
  type BlockMappingEntry,
  type BlockNode,
  type BlockWorkspaceSnapshot,
  type WorkspaceToProgramResult,
} from "./adapter.js";
import { canPlaceBlock } from "./vocabulary.js";

export interface BlockEditorProjectionUpdate {
  readonly workspace: BlockWorkspaceSnapshot;
  readonly program: WorkspaceToProgramResult["program"];
  readonly blockMapping: readonly BlockMappingEntry[];
  readonly projection: ProjectionResult;
}

export type StatementContainerPath =
  | { readonly kind: "script"; readonly scriptIndex: number }
  | {
      readonly kind: "repeatBody" | "ifThen";
      readonly scriptIndex: number;
      readonly statementPath: readonly number[];
    };

export type WorkspaceChange =
  | {
      readonly type: "addBlock";
      readonly container: StatementContainerPath;
      readonly index: number;
      readonly block: BlockNode;
    }
  | {
      readonly type: "moveBlock";
      readonly from: StatementLocation;
      readonly to: { readonly container: StatementContainerPath; readonly index: number };
    }
  | { readonly type: "editBlock"; readonly location: StatementLocation; readonly block: BlockNode }
  | { readonly type: "deleteBlock"; readonly location: StatementLocation }
  | { readonly type: "addVariable"; readonly variable: ProgramVariable };

export interface StatementLocation {
  readonly container: StatementContainerPath;
  readonly index: number;
}

function cloneWorkspace(workspace: BlockWorkspaceSnapshot): BlockWorkspaceSnapshot {
  return structuredClone(workspace) as BlockWorkspaceSnapshot;
}

type MutableBlockNode = BlockNode & {
  inputs?: {
    body?: BlockNode[];
    then?: BlockNode[];
    condition?: BlockNode;
    left?: BlockNode;
    right?: BlockNode;
    value?: BlockNode;
    delta?: BlockNode;
  };
};

function referencedVariableIds(block: BlockNode): readonly string[] {
  const ids: string[] = [];
  const visit = (node: BlockNode | undefined): void => {
    if (node === undefined) {
      return;
    }
    const variableId = node.fields?.variableId;
    if (typeof variableId === "string" && !ids.includes(variableId)) {
      ids.push(variableId);
    }
    for (const input of Object.values(node.inputs ?? {})) {
      if (Array.isArray(input)) {
        input.forEach(visit);
      } else if ("type" in input) {
        visit(input);
      }
    }
  };
  visit(block);
  return ids;
}

function ensureDefaultVariables(workspace: BlockWorkspaceSnapshot, block: BlockNode): void {
  const variables = [...(workspace.variables ?? [])];
  let added = false;
  for (const variableId of referencedVariableIds(block)) {
    if (variables.some((variable) => variable.id === variableId)) {
      continue;
    }
    variables.push({ id: variableId, name: variableId, initialValue: 0, visible: true });
    added = true;
  }
  if (added) {
    (workspace as unknown as { variables?: readonly (typeof variables)[number][] }).variables =
      variables;
  }
}

function mutableStatementsFor(
  workspace: BlockWorkspaceSnapshot,
  container: StatementContainerPath,
): BlockNode[] {
  const script = workspace.scripts[container.scriptIndex];
  if (script === undefined) {
    throw new BlockEditorAdapterError(
      "INVALID_WORKSPACE",
      `scripts[${container.scriptIndex}]`,
      "expected a script",
      container.scriptIndex,
      "BLOCK_NOT_FOUND",
    );
  }
  if (container.kind === "script") {
    return script.statements as BlockNode[];
  }
  let current: BlockNode | undefined;
  let list = script.statements as BlockNode[];
  for (const index of container.statementPath) {
    current = list[index];
    if (current === undefined) {
      throw new BlockEditorAdapterError(
        "INVALID_WORKSPACE",
        `statementPath[${index}]`,
        "expected a statement block",
        index,
        "BLOCK_NOT_FOUND",
      );
    }
    if (current.type === "control_repeat") {
      list = (current.inputs?.body ?? []) as BlockNode[];
    } else if (current.type === "control_if") {
      list = (current.inputs?.then ?? []) as BlockNode[];
    } else {
      throw new BlockEditorAdapterError(
        "INVALID_FIELD_TYPE",
        current.id,
        "expected a container block",
        current.type,
        "NOT_A_CONTAINER",
      );
    }
  }
  if (container.kind === "repeatBody") {
    if (current?.type !== "control_repeat") {
      throw new BlockEditorAdapterError(
        "INVALID_FIELD_TYPE",
        current?.id ?? "statementPath",
        "expected a repeat block",
        current?.type,
        "NOT_A_CONTAINER",
      );
    }
    const mutable = current as MutableBlockNode;
    mutable.inputs = { ...mutable.inputs, body: (mutable.inputs?.body ?? []) as BlockNode[] };
    return mutable.inputs.body as BlockNode[];
  }
  if (current?.type !== "control_if") {
    throw new BlockEditorAdapterError(
      "INVALID_FIELD_TYPE",
      current?.id ?? "statementPath",
      "expected an if block",
      current?.type,
      "NOT_A_CONTAINER",
    );
  }
  const mutable = current as MutableBlockNode;
  mutable.inputs = { ...mutable.inputs, then: (mutable.inputs?.then ?? []) as BlockNode[] };
  return mutable.inputs.then as BlockNode[];
}

function assertStatementBlock(block: BlockNode): void {
  if (!canPlaceBlock(block.type, "statement")) {
    throw new BlockEditorAdapterError(
      "INVALID_FIELD_TYPE",
      block.id,
      "expected a statement block",
      block.type,
      "NOT_A_STATEMENT",
    );
  }
}

function clampInsertionIndex(index: number, length: number): number {
  if (!Number.isInteger(index) || index < 0 || index > length) {
    throw new BlockEditorAdapterError(
      "INVALID_FIELD_TYPE",
      "index",
      `expected an integer between 0 and ${length}`,
      index,
      "BAD_INDEX",
    );
  }
  return index;
}

export function projectWorkspace(workspace: BlockWorkspaceSnapshot): BlockEditorProjectionUpdate {
  const converted = workspaceToProgram(workspace);
  return {
    workspace,
    program: converted.program,
    blockMapping: converted.mapping,
    projection: projectProgram(converted.program),
  };
}

export function applyWorkspaceChange(
  workspace: BlockWorkspaceSnapshot,
  change: WorkspaceChange,
): BlockEditorProjectionUpdate {
  const next = cloneWorkspace(workspace);
  switch (change.type) {
    case "addBlock": {
      assertStatementBlock(change.block);
      ensureDefaultVariables(next, change.block);
      const list = mutableStatementsFor(next, change.container);
      list.splice(clampInsertionIndex(change.index, list.length), 0, change.block);
      break;
    }
    case "moveBlock": {
      const fromList = mutableStatementsFor(next, change.from.container);
      const [block] = fromList.splice(change.from.index, 1);
      if (block === undefined) {
        throw new BlockEditorAdapterError(
          "INVALID_WORKSPACE",
          "from.index",
          "expected a block to move",
          change.from.index,
          "BLOCK_NOT_FOUND",
        );
      }
      const toList = mutableStatementsFor(next, change.to.container);
      toList.splice(clampInsertionIndex(change.to.index, toList.length), 0, block);
      break;
    }
    case "editBlock": {
      assertStatementBlock(change.block);
      ensureDefaultVariables(next, change.block);
      const list = mutableStatementsFor(next, change.location.container);
      if (list[change.location.index] === undefined) {
        throw new BlockEditorAdapterError(
          "INVALID_WORKSPACE",
          "location.index",
          "expected a block to edit",
          change.location.index,
          "BLOCK_NOT_FOUND",
        );
      }
      list[change.location.index] = change.block;
      break;
    }
    case "deleteBlock": {
      const list = mutableStatementsFor(next, change.location.container);
      const deleted = list.splice(change.location.index, 1);
      if (deleted.length === 0) {
        throw new BlockEditorAdapterError(
          "INVALID_WORKSPACE",
          "location.index",
          "expected a block to delete",
          change.location.index,
          "BLOCK_NOT_FOUND",
        );
      }
      break;
    }
    case "addVariable": {
      const idCollidesWithScript = next.scripts.some(
        (script) => (script.programId ?? script.id) === change.variable.id,
      );
      const idAlreadyDeclared = next.variables?.some(
        (variable) => variable.id === change.variable.id,
      );
      if (idCollidesWithScript || idAlreadyDeclared) {
        throw new BlockEditorAdapterError(
          "INVALID_WORKSPACE",
          "variables",
          "expected a distinct variable id",
          change.variable.id,
        );
      }
      const variables = [...(next.variables ?? []), change.variable];
      (next as unknown as { variables?: readonly ProgramVariable[] }).variables = variables;
      break;
    }
  }
  return projectWorkspace(next);
}
