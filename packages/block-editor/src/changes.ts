import { projectProgram, type ProjectionResult } from "@agorix/code-generator";
import type { ProgramList, ProgramVariable } from "@agorix/program-model";
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
      readonly kind: "repeatBody" | "repeatUntilBody" | "ifThen" | "ifElse";
      readonly scriptIndex: number;
      readonly statementPath: readonly number[];
      readonly branchPath?: readonly ("body" | "then" | "else")[];
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
  | { readonly type: "addVariable"; readonly variable: ProgramVariable }
  | { readonly type: "renameVariable"; readonly variableId: string; readonly name: string }
  | { readonly type: "deleteVariable"; readonly variableId: string }
  | { readonly type: "addList"; readonly list: ProgramList }
  | { readonly type: "renameList"; readonly listId: string; readonly name: string }
  | { readonly type: "deleteList"; readonly listId: string }
  | {
      readonly type: "editListInitialItems";
      readonly listId: string;
      readonly items: readonly number[];
    };

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
    else?: BlockNode[];
    condition?: BlockNode;
    left?: BlockNode;
    right?: BlockNode;
    value?: BlockNode;
    delta?: BlockNode;
    index?: BlockNode;
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
  if (container.statementPath.length === 0) {
    throw new BlockEditorAdapterError(
      "INVALID_FIELD_TYPE",
      "statementPath",
      "expected a non-empty container path",
      container.statementPath,
      "NOT_A_CONTAINER",
    );
  }
  let list = script.statements as BlockNode[];
  if (
    container.branchPath !== undefined &&
    container.branchPath.length !== container.statementPath.length
  ) {
    throw new BlockEditorAdapterError(
      "INVALID_FIELD_TYPE",
      "branchPath",
      "expected one branch per path segment",
      container.branchPath,
      "NOT_A_CONTAINER",
    );
  }
  for (const [depth, index] of container.statementPath.entries()) {
    const current = list[index];
    if (current === undefined) {
      throw new BlockEditorAdapterError(
        "INVALID_WORKSPACE",
        `statementPath[${depth}]`,
        "expected a statement block",
        index,
        "BLOCK_NOT_FOUND",
      );
    }
    const last = depth === container.statementPath.length - 1;
    const branch =
      container.branchPath?.[depth] ??
      (last
        ? container.kind === "ifThen"
          ? "then"
          : container.kind === "ifElse"
            ? "else"
            : "body"
        : current.type === "control_if"
          ? "then"
          : "body");
    const valid =
      branch === "body"
        ? current.type === "control_repeat" || current.type === "control_repeat_until"
        : current.type === "control_if";
    const matchingKind =
      !last ||
      (branch === "body" &&
        ((container.kind === "repeatBody" && current.type === "control_repeat") ||
          (container.kind === "repeatUntilBody" && current.type === "control_repeat_until"))) ||
      (branch === "then" && container.kind === "ifThen") ||
      (branch === "else" && container.kind === "ifElse");
    if (!valid || !matchingKind) {
      throw new BlockEditorAdapterError(
        "INVALID_FIELD_TYPE",
        current.id,
        "expected a matching container branch",
        current.type,
        "NOT_A_CONTAINER",
      );
    }
    const mutable = current as MutableBlockNode;
    mutable.inputs = {
      ...mutable.inputs,
      [branch]: (mutable.inputs?.[branch] ?? []) as BlockNode[],
    };
    list = mutable.inputs[branch] as BlockNode[];
  }
  return list;
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
    case "renameVariable": {
      const variables = [...(next.variables ?? [])];
      const index = variables.findIndex((variable) => variable.id === change.variableId);
      if (
        index < 0 ||
        !change.name.trim() ||
        change.name.trim().length > 40 ||
        variables.some(
          (variable) =>
            variable.id !== change.variableId &&
            variable.name.toLowerCase() === change.name.trim().toLowerCase(),
        )
      )
        throw new BlockEditorAdapterError(
          "INVALID_WORKSPACE",
          "variables",
          "expected a declared variable and distinct valid name",
          change.variableId,
        );
      variables[index] = { ...variables[index]!, name: change.name.trim() };
      (next as unknown as { variables?: readonly ProgramVariable[] }).variables = variables;
      break;
    }
    case "deleteVariable": {
      if (!next.variables?.some((variable) => variable.id === change.variableId))
        throw new BlockEditorAdapterError(
          "INVALID_WORKSPACE",
          "variables",
          "expected a declared variable",
          change.variableId,
        );
      const referencesVariable = (node: BlockNode): boolean =>
        node.fields?.variableId === change.variableId ||
        Object.values(node.inputs ?? {}).some((input) =>
          Array.isArray(input)
            ? input.some(referencesVariable)
            : "type" in input && referencesVariable(input),
        );
      if (
        next.scripts.some(
          (script) =>
            script.statements.some(referencesVariable) ||
            script.procedures?.some((procedure) => procedure.body.some(referencesVariable)),
        )
      )
        throw new BlockEditorAdapterError(
          "INVALID_WORKSPACE",
          "variables",
          "variable is referenced by a block",
          change.variableId,
        );
      (next as unknown as { variables?: readonly ProgramVariable[] }).variables =
        next.variables!.filter((variable) => variable.id !== change.variableId);
      break;
    }
    case "addList": {
      if (
        next.lists?.some((list) => list.id === change.list.id) ||
        next.variables?.some((variable) => variable.id === change.list.id) ||
        next.scripts.some((script) => (script.programId ?? script.id) === change.list.id)
      ) {
        throw new BlockEditorAdapterError(
          "INVALID_WORKSPACE",
          "lists",
          "expected a distinct list id",
          change.list.id,
        );
      }
      (next as unknown as { lists?: readonly ProgramList[] }).lists = [
        ...(next.lists ?? []),
        change.list,
      ];
      break;
    }
    case "editListInitialItems": {
      const index = next.lists?.findIndex((list) => list.id === change.listId) ?? -1;
      if (index < 0)
        throw new BlockEditorAdapterError(
          "INVALID_WORKSPACE",
          "lists",
          "expected a declared list",
          change.listId,
        );
      const lists = [...(next.lists ?? [])];
      lists[index] = { ...lists[index]!, initialItems: [...change.items] };
      (next as unknown as { lists?: readonly ProgramList[] }).lists = lists;
      break;
    }
    case "renameList": {
      const lists = [...(next.lists ?? [])];
      const index = lists.findIndex((list) => list.id === change.listId);
      if (
        index < 0 ||
        !change.name.trim() ||
        change.name.trim().length > 40 ||
        lists.some(
          (list) =>
            list.id !== change.listId &&
            list.name.toLowerCase() === change.name.trim().toLowerCase(),
        )
      )
        throw new BlockEditorAdapterError(
          "INVALID_WORKSPACE",
          "lists",
          "expected a declared list and distinct valid name",
          change.listId,
        );
      lists[index] = { ...lists[index]!, name: change.name.trim() };
      (next as unknown as { lists?: readonly ProgramList[] }).lists = lists;
      break;
    }
    case "deleteList": {
      if (!next.lists?.some((list) => list.id === change.listId))
        throw new BlockEditorAdapterError(
          "INVALID_WORKSPACE",
          "lists",
          "expected a declared list",
          change.listId,
        );
      const referencesList = (node: BlockNode): boolean =>
        node.fields?.listId === change.listId ||
        Object.values(node.inputs ?? {}).some((input) =>
          Array.isArray(input)
            ? input.some(referencesList)
            : "type" in input && referencesList(input),
        );
      if (
        next.scripts.some(
          (script) =>
            script.statements.some(referencesList) ||
            script.procedures?.some((procedure) => procedure.body.some(referencesList)),
        )
      )
        throw new BlockEditorAdapterError(
          "INVALID_WORKSPACE",
          "lists",
          "list is referenced by a block",
          change.listId,
        );
      (next as unknown as { lists?: readonly ProgramList[] }).lists = next.lists!.filter(
        (list) => list.id !== change.listId,
      );
      break;
    }
  }
  return projectWorkspace(next);
}
