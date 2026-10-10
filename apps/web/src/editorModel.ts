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
import {
  migrateLegacyTriggers,
  type ProgramVariable,
  type ProjectProgram,
} from "@agorix/program-model";
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
  | "looks_say"
  | "looks_think"
  | "looks_show"
  | "looks_hide"
  | "looks_set_size"
  | "looks_switch_costume"
  | "looks_switch_backdrop"
  | "sound_play"
  | "sound_stop"
  | "event_broadcast"
  | "variables_set"
  | "variables_change"
  | "variables_show"
  | "variables_hide"
  | "control_repeat"
  | "control_if";

export type AddableTriggerType =
  "event_on_key_pressed" | "event_on_actor_clicked" | "event_on_message";

export type StatementPath = readonly number[];

export type IfConditionKind = "touchingGoal" | "scoreLessThan" | "scoreEquals";

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

export function blockNodeId(path: number | StatementPath, scriptIndex = 0): string {
  const indexes = typeof path === "number" ? [path] : [...path];
  return indexes.reduce((nodeId, index, depth) => {
    if (depth === 0) return `${nodeId}/statements[${index}]`;
    return `${nodeId}/body[${index}]`;
  }, `scripts[${scriptIndex}]`);
}

export function blockNodeIdForPath(
  workspace: BlockWorkspaceSnapshot,
  path: StatementPath,
  scriptIndex = 0,
): string {
  if (path.length === 0) {
    throw new Error("Expected a non-empty statement path");
  }
  let nodeId = `scripts[${scriptIndex}]`;
  let list: readonly BlockNode[] = workspace.scripts[scriptIndex]?.statements ?? [];
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

function nextBlockIndex(workspace: BlockWorkspaceSnapshot, scriptIndex = 0): number {
  return workspace.scripts[scriptIndex]?.statements.length ?? 0;
}

export function addBlockToWorkspace(
  workspace: BlockWorkspaceSnapshot,
  type: AddableBlockType,
  scriptIndex = 0,
): EditorProjection {
  return addBlockToWorkspaceAt(
    workspace,
    type,
    [],
    nextBlockIndex(workspace, scriptIndex),
    scriptIndex,
  );
}

function triggerProgramId(type: AddableTriggerType, index: number): string {
  switch (type) {
    case "event_on_key_pressed":
      return `key-${index}`;
    case "event_on_actor_clicked":
      return `click-${index}`;
    case "event_on_message":
      return `message-${index}`;
  }
}

export function addScriptToWorkspace(
  workspace: BlockWorkspaceSnapshot,
  triggerType: AddableTriggerType,
): EditorProjection {
  const index = workspace.scripts.length;
  return project({
    scripts: [
      ...workspace.scripts,
      {
        id: `block:scripts_${index}_`,
        programId: triggerProgramId(triggerType, index),
        trigger: createDefaultBlock(triggerType, `block:scripts_${index}_trigger`),
        statements: [],
      },
    ],
  });
}

export function editScriptTriggerField(
  workspace: BlockWorkspaceSnapshot,
  scriptIndex: number,
  field: "key" | "message",
  value: string,
): EditorProjection {
  const script = workspace.scripts[scriptIndex];
  if (script === undefined) {
    throw new Error(`No script at index ${scriptIndex}`);
  }
  return project({
    scripts: workspace.scripts.map((candidate, index) =>
      index === scriptIndex
        ? {
            ...candidate,
            trigger: {
              ...candidate.trigger,
              fields: { ...candidate.trigger.fields, [field]: value },
            },
          }
        : candidate,
    ),
  });
}

export function addBlockToWorkspaceAt(
  workspace: BlockWorkspaceSnapshot,
  type: AddableBlockType,
  containerPath: StatementPath,
  index: number,
  scriptIndex = 0,
): EditorProjection {
  const block = createDefaultBlock(type, blockId(type, index));
  const nextBlock: BlockNode = refersToVariable(type)
    ? { ...block, fields: { ...block.fields, variableId: defaultVariableIdFor(workspace) } }
    : block;
  return fromUpdate(
    applyWorkspaceChange(workspace, {
      type: "addBlock",
      container: containerForPath(workspace, containerPath, scriptIndex),
      index,
      block: nextBlock,
    }),
  );
}

function refersToVariable(type: AddableBlockType): boolean {
  return (
    type === "variables_set" ||
    type === "variables_change" ||
    type === "variables_show" ||
    type === "variables_hide"
  );
}

export function defaultVariableIdFor(workspace: BlockWorkspaceSnapshot): string {
  return workspace.variables?.[0]?.id ?? "score";
}

function slugify(text: string): string {
  const slug = text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.length > 0 ? slug.slice(0, 60) : "variable";
}

export function variableNamed(
  variables: readonly ProgramVariable[] | undefined,
  name: string,
): string {
  const trimmed = name.trim();
  const base = slugify(trimmed);
  let id = base;
  let suffix = 2;
  while (variables?.some((variable) => variable.id === id)) {
    id = `${base}${suffix}`;
    suffix += 1;
  }
  return id;
}

export function makeVariableInWorkspace(
  workspace: BlockWorkspaceSnapshot,
  rawName: string,
): EditorProjection {
  const name = rawName.trim();
  const variable: ProgramVariable = {
    id: variableNamed(workspace.variables, name),
    name,
    initialValue: 0,
    visible: true,
  };
  return fromUpdate(applyWorkspaceChange(workspace, { type: "addVariable", variable }));
}

export function addVariableSetBlockFor(
  workspace: BlockWorkspaceSnapshot,
  variableId: string,
  scriptIndex = 0,
): EditorProjection {
  const index = nextBlockIndex(workspace, scriptIndex);
  const block = createDefaultBlock("variables_set", blockId("variables_set", index));
  const targetBlock: BlockNode = {
    ...block,
    fields: { ...block.fields, variableId },
  };
  return fromUpdate(
    applyWorkspaceChange(workspace, {
      type: "addBlock",
      container: containerForPath(workspace, [], scriptIndex),
      index,
      block: targetBlock,
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
  scriptIndex = 0,
): EditorProjection {
  const from = locationForPath(workspace, fromPath, scriptIndex);
  const toContainer = containerForPath(workspace, toContainerPath, scriptIndex);
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
  scriptIndex = 0,
): EditorProjection {
  return fromUpdate(
    applyWorkspaceChange(workspace, {
      type: "deleteBlock",
      location: locationForPath(workspace, path, scriptIndex),
    }),
  );
}

export function duplicateBlockInWorkspace(
  workspace: BlockWorkspaceSnapshot,
  path: StatementPath,
  scriptIndex = 0,
): EditorProjection {
  const block = blockAtPath(workspace, path, scriptIndex);
  const location = locationForPath(workspace, path, scriptIndex);
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
  field: "steps" | "degrees" | "count" | "size",
  value: number,
): EditorProjection {
  return editNumericBlockFieldAt(workspace, [index], field, value);
}

export function editNumericBlockFieldAt(
  workspace: BlockWorkspaceSnapshot,
  path: StatementPath,
  field: "steps" | "degrees" | "count" | "size",
  value: number,
  scriptIndex = 0,
): EditorProjection {
  return editBlockFieldAt(workspace, path, field, value, scriptIndex);
}

export function editVariableNumberInputAt(
  workspace: BlockWorkspaceSnapshot,
  path: StatementPath,
  value: number,
  scriptIndex = 0,
): EditorProjection {
  const block = blockAtPath(workspace, path, scriptIndex);
  const inputName =
    block.type === "variables_set"
      ? "value"
      : block.type === "variables_change"
        ? "delta"
        : undefined;
  if (inputName === undefined) {
    throw new Error(`Block at ${path.join(".")} has no editable variable number input`);
  }
  const current = block.inputs?.[inputName];
  const nextBlock: BlockNode = {
    ...block,
    inputs: {
      ...block.inputs,
      [inputName]: {
        id: current?.id ?? `${block.id}:${inputName}`,
        type: "literal_number",
        fields: { value },
      },
    },
  };
  return fromUpdate(
    applyWorkspaceChange(workspace, {
      type: "editBlock",
      location: locationForPath(workspace, path, scriptIndex),
      block: nextBlock,
    }),
  );
}

function scoreComparisonBlock(
  blockId: string,
  type: "operator_less_than" | "operator_equals",
  value: number,
): BlockNode {
  return {
    id: `${blockId}:condition`,
    type,
    inputs: {
      left: {
        id: `${blockId}:condition:left`,
        type: "variables_value",
        fields: { variableId: "score" },
      },
      right: {
        id: `${blockId}:condition:right`,
        type: "literal_number",
        fields: { value },
      },
    },
  };
}

export function editIfConditionAt(
  workspace: BlockWorkspaceSnapshot,
  path: StatementPath,
  kind: IfConditionKind,
  scriptIndex = 0,
): EditorProjection {
  const block = blockAtPath(workspace, path, scriptIndex);
  if (block.type !== "control_if") {
    throw new Error(`Block at ${path.join(".")} is not an if block`);
  }
  const currentValue = ifConditionNumberValue(block) ?? 10;
  const condition =
    kind === "touchingGoal"
      ? createDefaultBlock("sensing_touching_goal", `${block.id}:condition`)
      : kind === "scoreLessThan"
        ? scoreComparisonBlock(block.id, "operator_less_than", currentValue)
        : scoreComparisonBlock(block.id, "operator_equals", currentValue);
  const nextBlock: BlockNode = {
    ...block,
    inputs: { ...block.inputs, condition },
  };
  return fromUpdate(
    applyWorkspaceChange(workspace, {
      type: "editBlock",
      location: locationForPath(workspace, path, scriptIndex),
      block: nextBlock,
    }),
  );
}

export function editIfConditionNumberAt(
  workspace: BlockWorkspaceSnapshot,
  path: StatementPath,
  value: number,
  scriptIndex = 0,
): EditorProjection {
  const block = blockAtPath(workspace, path, scriptIndex);
  if (block.type !== "control_if") {
    throw new Error(`Block at ${path.join(".")} is not an if block`);
  }
  const condition = block.inputs?.condition;
  if (condition?.type !== "operator_less_than" && condition?.type !== "operator_equals") {
    throw new Error(`If block at ${path.join(".")} has no editable comparison number`);
  }
  const nextBlock: BlockNode = {
    ...block,
    inputs: {
      ...block.inputs,
      condition: {
        ...condition,
        inputs: {
          ...condition.inputs,
          right: {
            id: condition.inputs?.right?.id ?? `${condition.id}:right`,
            type: "literal_number",
            fields: { value },
          },
        },
      },
    },
  };
  return fromUpdate(
    applyWorkspaceChange(workspace, {
      type: "editBlock",
      location: locationForPath(workspace, path, scriptIndex),
      block: nextBlock,
    }),
  );
}

export function ifConditionKind(block: BlockNode): IfConditionKind {
  const condition = block.inputs?.condition;
  if (condition?.type === "operator_less_than") {
    return "scoreLessThan";
  }
  if (condition?.type === "operator_equals") {
    return "scoreEquals";
  }
  return "touchingGoal";
}

export function ifConditionNumberValue(block: BlockNode): number | undefined {
  const condition = block.inputs?.condition;
  if (condition?.type !== "operator_less_than" && condition?.type !== "operator_equals") {
    return undefined;
  }
  const value = condition.inputs?.right?.fields?.value;
  return typeof value === "number" ? value : 10;
}

export function editBlockFieldAt(
  workspace: BlockWorkspaceSnapshot,
  path: StatementPath,
  field: string,
  value: unknown,
  scriptIndex = 0,
): EditorProjection {
  const block = blockAtPath(workspace, path, scriptIndex);
  if (block === undefined) {
    throw new Error(`No block at path ${path.join(".")}`);
  }
  const nextBlock: BlockNode = { ...block, fields: { ...block.fields, [field]: value } };
  return fromUpdate(
    applyWorkspaceChange(workspace, {
      type: "editBlock",
      location: locationForPath(workspace, path, scriptIndex),
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
  scriptIndex = 0,
): readonly BlockNode[] {
  if (containerPath.length === 0) {
    return workspace.scripts[scriptIndex]?.statements ?? [];
  }
  const container = blockAtPath(workspace, containerPath, scriptIndex);
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
  scriptIndex = 0,
): StatementContainerPath {
  if (containerPath.length === 0) {
    return { kind: "script", scriptIndex };
  }
  const container = blockAtPath(workspace, containerPath, scriptIndex);
  if (container.type === "control_repeat") {
    return { kind: "repeatBody", scriptIndex, statementPath: containerPath };
  }
  if (container.type === "control_if") {
    return { kind: "ifThen", scriptIndex, statementPath: containerPath };
  }
  throw new Error(`Block at ${containerPath.join(".")} cannot contain statements`);
}

function locationForPath(workspace: BlockWorkspaceSnapshot, path: StatementPath, scriptIndex = 0) {
  return {
    container: containerForPath(workspace, parentContainerPath(path), scriptIndex),
    index: indexInContainer(path),
  };
}

function blockAtPath(
  workspace: BlockWorkspaceSnapshot,
  path: StatementPath,
  scriptIndex = 0,
): BlockNode {
  if (path.length === 0) {
    throw new Error("Expected a non-empty statement path");
  }
  let list: readonly BlockNode[] = workspace.scripts[scriptIndex]?.statements ?? [];
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
  if (block.inputs?.left !== undefined) collectBlockIds(block.inputs.left, ids);
  if (block.inputs?.right !== undefined) collectBlockIds(block.inputs.right, ids);
  if (block.inputs?.value !== undefined) collectBlockIds(block.inputs.value, ids);
  if (block.inputs?.delta !== undefined) collectBlockIds(block.inputs.delta, ids);
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
            ...(current.inputs.left === undefined ? {} : { left: clone(current.inputs.left) }),
            ...(current.inputs.right === undefined ? {} : { right: clone(current.inputs.right) }),
            ...(current.inputs.value === undefined ? {} : { value: clone(current.inputs.value) }),
            ...(current.inputs.delta === undefined ? {} : { delta: clone(current.inputs.delta) }),
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
