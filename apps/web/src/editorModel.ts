import {
  applyWorkspaceChange,
  createDefaultBlock,
  programToWorkspace,
  projectWorkspace,
  type BlockEditorProjectionUpdate,
  type BlockNode,
  type BlockType,
  type BlockWorkspaceSnapshot,
  type StatementContainerPath,
} from "@agorix/block-editor";
import { FIRST_MISSION } from "@agorix/curriculum";
import { migrateLegacyTriggers, type ProjectProgram } from "@agorix/program-model";
import { createStageSession, type StageSession } from "@agorix/stage";

export interface EditorProjection {
  readonly workspace: BlockWorkspaceSnapshot;
  readonly program: ProjectProgram;
  readonly code: string;
  readonly codeMapping: Readonly<Record<string, { readonly start: number; readonly end: number }>>;
}

export interface EditorModel extends EditorProjection {
  readonly stage: StageSession;
}

export type AddableBlockType =
  | "motion_move"
  | "motion_turn"
  | "motion_set_x"
  | "motion_set_y"
  | "control_wait"
  | "looks_show"
  | "looks_hide"
  | "looks_set_size"
  | "looks_say"
  | "control_repeat"
  | "control_if";

export type NumericField = "steps" | "degrees" | "count" | "x" | "y" | "seconds" | "percent";

export type StatementPath = readonly number[];

export const INITIAL_STAGE = createStageSession({
  sprite: { ...FIRST_MISSION.starterStage.sprite, radius: 12 },
  goal: { ...FIRST_MISSION.starterStage.goal, radius: 14 },
  viewport: { width: 264, height: 192 },
});

function fromUpdate(update: BlockEditorProjectionUpdate): EditorProjection {
  return {
    workspace: update.workspace,
    program: update.program,
    code: update.projection.code,
    codeMapping: update.projection.mapping,
  };
}

function project(workspace: BlockWorkspaceSnapshot): EditorProjection {
  return fromUpdate(projectWorkspace(workspace));
}

export function createEditorModel(): EditorModel {
  return {
    ...project(programToWorkspace(FIRST_MISSION.starterProject).workspace),
    stage: INITIAL_STAGE,
  };
}

export function createEditorModelFromProgram(program: ProjectProgram): EditorModel {
  // Projects saved before green-flag scripts open with the green-flag hat; they run the same.
  return {
    ...project(programToWorkspace(migrateLegacyTriggers(program)).workspace),
    stage: INITIAL_STAGE,
  };
}

export function blockNodeId(path: number | StatementPath): string {
  const indexes = typeof path === "number" ? [path] : [...path];
  return indexes.reduce((nodeId, index, depth) => {
    if (depth === 0) return `${nodeId}/statements[${index}]`;
    return `${nodeId}/body[${index}]`;
  }, "scripts[0]");
}

export function blockNodeIdForPath(workspace: BlockWorkspaceSnapshot, path: StatementPath): string {
  if (path.length === 0) {
    throw new Error("Expected a non-empty statement path");
  }
  let nodeId = "scripts[0]";
  let list: readonly BlockNode[] = workspace.scripts[0]?.statements ?? [];
  for (const [depth, index] of path.entries()) {
    const block = list[index];
    if (block === undefined) {
      throw new Error(`No block at path ${path.slice(0, depth + 1).join(".")}`);
    }
    nodeId += depth === 0 ? `/statements[${index}]` : `[${index}]`;
    if (depth === path.length - 1) {
      return nodeId;
    }
    if (block.type === "control_repeat") {
      nodeId += "/body";
      list = block.inputs?.body ?? [];
    } else if (block.type === "control_if") {
      nodeId += "/then";
      list = block.inputs?.then ?? [];
    } else {
      throw new Error(`Block at ${path.slice(0, depth + 1).join(".")} cannot contain statements`);
    }
  }
  return nodeId;
}

function blockId(type: BlockType, index: number): string {
  return `workspace:${type}:${index}`;
}

function nextBlockIndex(workspace: BlockWorkspaceSnapshot): number {
  return workspace.scripts[0]?.statements.length ?? 0;
}

export function addBlockToWorkspace(
  workspace: BlockWorkspaceSnapshot,
  type: AddableBlockType,
): EditorProjection {
  return addBlockToWorkspaceAt(workspace, type, [], nextBlockIndex(workspace));
}

export function addBlockToWorkspaceAt(
  workspace: BlockWorkspaceSnapshot,
  type: AddableBlockType,
  containerPath: StatementPath,
  index: number,
): EditorProjection {
  const block = createDefaultBlock(type, blockId(type, index));
  return fromUpdate(
    applyWorkspaceChange(workspace, {
      type: "addBlock",
      container: containerForPath(workspace, containerPath),
      index,
      block,
    }),
  );
}

export function moveBlockInWorkspace(
  workspace: BlockWorkspaceSnapshot,
  fromIndex: number,
  toIndex: number,
): EditorProjection {
  return moveBlockInWorkspaceByPath(workspace, [fromIndex], [], toIndex);
}

export function moveBlockInWorkspaceByPath(
  workspace: BlockWorkspaceSnapshot,
  fromPath: StatementPath,
  toContainerPath: StatementPath,
  toIndex: number,
): EditorProjection {
  const from = locationForPath(workspace, fromPath);
  const toContainer = containerForPath(workspace, toContainerPath);
  return fromUpdate(
    applyWorkspaceChange(workspace, {
      type: "moveBlock",
      from,
      to: { container: toContainer, index: toIndex },
    }),
  );
}

export function deleteBlockFromWorkspace(
  workspace: BlockWorkspaceSnapshot,
  index: number,
): EditorProjection {
  return deleteBlockFromWorkspaceAt(workspace, [index]);
}

export function deleteBlockFromWorkspaceAt(
  workspace: BlockWorkspaceSnapshot,
  path: StatementPath,
): EditorProjection {
  return fromUpdate(
    applyWorkspaceChange(workspace, {
      type: "deleteBlock",
      location: locationForPath(workspace, path),
    }),
  );
}

export function duplicateBlockInWorkspace(
  workspace: BlockWorkspaceSnapshot,
  path: StatementPath,
): EditorProjection {
  const block = blockAtPath(workspace, path);
  const location = locationForPath(workspace, path);
  return fromUpdate(
    applyWorkspaceChange(workspace, {
      type: "addBlock",
      container: location.container,
      index: location.index + 1,
      block: cloneBlockTreeWithFreshIds(block, workspace),
    }),
  );
}

export function editNumericBlockField(
  workspace: BlockWorkspaceSnapshot,
  index: number,
  field: NumericField,
  value: number,
): EditorProjection {
  return editNumericBlockFieldAt(workspace, [index], field, value);
}

export function editNumericBlockFieldAt(
  workspace: BlockWorkspaceSnapshot,
  path: StatementPath,
  field: NumericField | "message",
  value: number | string,
): EditorProjection {
  const block = blockAtPath(workspace, path);
  if (block === undefined) {
    throw new Error(`No block at path ${path.join(".")}`);
  }
  const nextBlock: BlockNode = { ...block, fields: { ...block.fields, [field]: value } };
  return fromUpdate(
    applyWorkspaceChange(workspace, {
      type: "editBlock",
      location: locationForPath(workspace, path),
      block: nextBlock,
    }),
  );
}

export function resetWorkspace(): EditorProjection {
  return project(programToWorkspace(FIRST_MISSION.starterProject).workspace);
}

export function codeSliceForNode(model: EditorProjection, nodeId: string): string {
  const range = model.codeMapping[nodeId];
  if (range === undefined) {
    return "";
  }
  return model.code.slice(range.start, range.end);
}

export function statementListAtPath(
  workspace: BlockWorkspaceSnapshot,
  containerPath: StatementPath,
): readonly BlockNode[] {
  if (containerPath.length === 0) {
    return workspace.scripts[0]?.statements ?? [];
  }
  const container = blockAtPath(workspace, containerPath);
  if (container.type === "control_repeat") {
    return container.inputs?.body ?? [];
  }
  if (container.type === "control_if") {
    return container.inputs?.then ?? [];
  }
  throw new Error(`Block at ${containerPath.join(".")} cannot contain statements`);
}

export function canContainStatements(block: BlockNode): boolean {
  return block.type === "control_repeat" || block.type === "control_if";
}

export function childContainerPathFor(path: StatementPath): StatementPath {
  return [...path];
}

export function parentContainerPath(path: StatementPath): StatementPath {
  return path.slice(0, -1);
}

export function indexInContainer(path: StatementPath): number {
  const index = path[path.length - 1];
  if (index === undefined) {
    throw new Error("Expected a statement path");
  }
  return index;
}

function containerForPath(
  workspace: BlockWorkspaceSnapshot,
  containerPath: StatementPath,
): StatementContainerPath {
  if (containerPath.length === 0) {
    return { kind: "script", scriptIndex: 0 };
  }
  const container = blockAtPath(workspace, containerPath);
  if (container.type === "control_repeat") {
    return { kind: "repeatBody", scriptIndex: 0, statementPath: containerPath };
  }
  if (container.type === "control_if") {
    return { kind: "ifThen", scriptIndex: 0, statementPath: containerPath };
  }
  throw new Error(`Block at ${containerPath.join(".")} cannot contain statements`);
}

function locationForPath(workspace: BlockWorkspaceSnapshot, path: StatementPath) {
  return {
    container: containerForPath(workspace, parentContainerPath(path)),
    index: indexInContainer(path),
  };
}

function blockAtPath(workspace: BlockWorkspaceSnapshot, path: StatementPath): BlockNode {
  if (path.length === 0) {
    throw new Error("Expected a non-empty statement path");
  }
  let list: readonly BlockNode[] = workspace.scripts[0]?.statements ?? [];
  let current: BlockNode | undefined;
  for (const [depth, index] of path.entries()) {
    current = list[index];
    if (current === undefined) {
      throw new Error(`No block at path ${path.slice(0, depth + 1).join(".")}`);
    }
    if (depth === path.length - 1) {
      return current;
    }
    list =
      current.type === "control_repeat"
        ? (current.inputs?.body ?? [])
        : current.type === "control_if"
          ? (current.inputs?.then ?? [])
          : [];
  }
  throw new Error(`No block at path ${path.join(".")}`);
}

function collectBlockIds(block: BlockNode, ids: Set<string>): void {
  ids.add(block.id);
  for (const child of block.inputs?.body ?? []) collectBlockIds(child, ids);
  for (const child of block.inputs?.then ?? []) collectBlockIds(child, ids);
  if (block.inputs?.condition !== undefined) collectBlockIds(block.inputs.condition, ids);
}

function workspaceBlockIds(workspace: BlockWorkspaceSnapshot): Set<string> {
  const ids = new Set<string>();
  for (const script of workspace.scripts) {
    collectBlockIds(script.trigger, ids);
    for (const block of script.statements) collectBlockIds(block, ids);
  }
  return ids;
}

function uniqueId(base: string, used: Set<string>): string {
  let index = 1;
  let candidate = `${base}:copy`;
  while (used.has(candidate)) {
    index += 1;
    candidate = `${base}:copy-${index}`;
  }
  used.add(candidate);
  return candidate;
}

function cloneBlockTreeWithFreshIds(
  block: BlockNode,
  workspace: BlockWorkspaceSnapshot,
): BlockNode {
  const used = workspaceBlockIds(workspace);
  function clone(current: BlockNode): BlockNode {
    const id = uniqueId(current.id, used);
    const inputs =
      current.inputs === undefined
        ? undefined
        : {
            ...(current.inputs.body === undefined
              ? {}
              : { body: current.inputs.body.map((child) => clone(child)) }),
            ...(current.inputs.then === undefined
              ? {}
              : { then: current.inputs.then.map((child) => clone(child)) }),
            ...(current.inputs.condition === undefined
              ? {}
              : { condition: clone(current.inputs.condition) }),
          };
    return {
      ...current,
      id,
      ...(inputs === undefined ? {} : { inputs }),
    };
  }
  return clone(block);
}

/**
 * Drop slots are numbered before the dragged block leaves its list, while a move is indexed
 * after removal. Translates a slot into the final index for a move within the same container.
 */
export function finalMoveIndex(
  fromPath: StatementPath,
  toContainerPath: StatementPath,
  slotIndex: number,
): number {
  const sameContainer =
    parentContainerPath(fromPath).length === toContainerPath.length &&
    parentContainerPath(fromPath).every((segment, i) => segment === toContainerPath[i]);
  return sameContainer && slotIndex > indexInContainer(fromPath) ? slotIndex - 1 : slotIndex;
}
