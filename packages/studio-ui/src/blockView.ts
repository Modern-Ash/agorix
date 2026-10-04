import {
  getBlockDefinition,
  type BlockNode,
  type BlockType,
  type BlockWorkspaceSnapshot,
  type StatementContainerPath,
  type StatementLocation,
} from "@agorix/block-editor";
import type { DragSource, InsertionPoint } from "@agorix/interaction-core";

export interface RenderBlock {
  readonly id: string;
  readonly type: BlockType;
  readonly label: string;
  readonly location: StatementLocation;
  readonly siblingCount: number;
  readonly fields: Readonly<Record<string, unknown>>;
}

export type RenderRow =
  | { readonly kind: "script"; readonly scriptIndex: number }
  | { readonly kind: "slot"; readonly slot: InsertionPoint; readonly depth: number }
  | { readonly kind: "block"; readonly block: RenderBlock; readonly depth: number };

function pushList(
  rows: RenderRow[],
  list: readonly BlockNode[],
  container: StatementContainerPath,
  scriptIndex: number,
  path: readonly number[],
  depth: number,
): void {
  rows.push({ kind: "slot", slot: { container, index: 0 }, depth });
  list.forEach((node, index) => {
    rows.push({
      kind: "block",
      depth,
      block: {
        id: node.id,
        type: node.type,
        label: getBlockDefinition(node.type)?.label ?? node.type,
        location: { container, index },
        siblingCount: list.length,
        fields: node.fields ?? {},
      },
    });
    const childPath = [...path, index];
    if (node.type === "control_repeat") {
      pushList(
        rows,
        node.inputs?.body ?? [],
        { kind: "repeatBody", scriptIndex, statementPath: childPath },
        scriptIndex,
        childPath,
        depth + 1,
      );
    } else if (node.type === "control_if") {
      pushList(
        rows,
        node.inputs?.then ?? [],
        { kind: "ifThen", scriptIndex, statementPath: childPath },
        scriptIndex,
        childPath,
        depth + 1,
      );
    }
    rows.push({ kind: "slot", slot: { container, index: index + 1 }, depth });
  });
}

/** Slot index n means "insert so the block ends up at position n"; the last slot appends. */
export function toRows(workspace: BlockWorkspaceSnapshot): RenderRow[] {
  const rows: RenderRow[] = [];
  workspace.scripts.forEach((script, scriptIndex) => {
    rows.push({ kind: "script", scriptIndex });
    pushList(rows, script.statements, { kind: "script", scriptIndex }, scriptIndex, [], 0);
  });
  return rows;
}

function sameContainer(a: StatementContainerPath, b: StatementContainerPath): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Slots are numbered before the dragged block is removed; moveBlock indexes the list after
 * removal. Translate a slot into the final index, or undefined when the drop is a no-op.
 */
export function dropPointFor(source: DragSource, slot: InsertionPoint): InsertionPoint | undefined {
  if (source.kind !== "block" || !sameContainer(source.location.container, slot.container)) {
    return slot;
  }
  const from = source.location.index;
  const index = slot.index > from ? slot.index - 1 : slot.index;
  return index === from ? undefined : { container: slot.container, index };
}
