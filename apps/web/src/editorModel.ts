import {
  applyWorkspaceChange,
  createDefaultBlock,
  createStarterWorkspace,
  programToWorkspace,
  projectWorkspace,
  type BlockEditorProjectionUpdate,
  type BlockNode,
  type BlockType,
  type BlockWorkspaceSnapshot,
} from "@agorix/block-editor";
import type { ProjectProgram } from "@agorix/program-model";
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

export type AddableBlockType = "motion_move" | "motion_turn" | "control_repeat" | "control_if";

export const INITIAL_STAGE = createStageSession({
  sprite: { x: 52, y: 128, heading: 0, radius: 12 },
  goal: { x: 212, y: 128, radius: 14 },
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
  return { ...project(createStarterWorkspace()), stage: INITIAL_STAGE };
}

export function createEditorModelFromProgram(program: ProjectProgram): EditorModel {
  return { ...project(programToWorkspace(program).workspace), stage: INITIAL_STAGE };
}

export function blockNodeId(index: number): string {
  return `scripts[0]/statements[${index}]`;
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
  const index = nextBlockIndex(workspace);
  const block = createDefaultBlock(type, blockId(type, index));
  return fromUpdate(
    applyWorkspaceChange(workspace, {
      type: "addBlock",
      container: { kind: "script", scriptIndex: 0 },
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
  return fromUpdate(
    applyWorkspaceChange(workspace, {
      type: "moveBlock",
      from: { container: { kind: "script", scriptIndex: 0 }, index: fromIndex },
      to: { container: { kind: "script", scriptIndex: 0 }, index: toIndex },
    }),
  );
}

export function deleteBlockFromWorkspace(
  workspace: BlockWorkspaceSnapshot,
  index: number,
): EditorProjection {
  return fromUpdate(
    applyWorkspaceChange(workspace, {
      type: "deleteBlock",
      location: { container: { kind: "script", scriptIndex: 0 }, index },
    }),
  );
}

export function editNumericBlockField(
  workspace: BlockWorkspaceSnapshot,
  index: number,
  field: "steps" | "degrees" | "count",
  value: number,
): EditorProjection {
  const block = workspace.scripts[0]?.statements[index];
  if (block === undefined) {
    throw new Error(`No block at index ${index}`);
  }
  const nextBlock: BlockNode = { ...block, fields: { ...block.fields, [field]: value } };
  return fromUpdate(
    applyWorkspaceChange(workspace, {
      type: "editBlock",
      location: { container: { kind: "script", scriptIndex: 0 }, index },
      block: nextBlock,
    }),
  );
}

export function resetWorkspace(): EditorProjection {
  return project(createStarterWorkspace());
}

export function codeSliceForNode(model: EditorProjection, nodeId: string): string {
  const range = model.codeMapping[nodeId];
  if (range === undefined) {
    return "";
  }
  return model.code.slice(range.start, range.end);
}
