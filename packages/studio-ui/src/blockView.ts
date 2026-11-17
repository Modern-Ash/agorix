import {
  getBlockDefinition,
  type BlockNode,
  type BlockType,
  type BlockWorkspaceSnapshot,
  type StatementContainerPath,
  type StatementLocation,
} from "@agorix/block-editor";
import type { DragSource, InsertionPoint, Intent } from "@agorix/interaction-core";

export interface RenderBlock {
  readonly id: string;
  readonly type: BlockType;
  readonly label: string;
  readonly location: StatementLocation;
  readonly siblingCount: number;
  readonly fields: Readonly<Record<string, unknown>>;
  readonly condition?: BlockNode;
  readonly value?: BlockNode;
  readonly delta?: BlockNode;
  readonly index?: BlockNode;
}

export type RenderRow =
  | { readonly kind: "script"; readonly scriptIndex: number }
  | { readonly kind: "slot"; readonly slot: InsertionPoint; readonly depth: number }
  | { readonly kind: "elseBranch"; readonly scriptIndex: number; readonly depth: number }
  | { readonly kind: "block"; readonly block: RenderBlock; readonly depth: number };

/** Stable DOM identity of a block by where it sits; block ids are positional, so focus follows location. */
export function locationKey(location: StatementLocation): string {
  return `${JSON.stringify(location.container)}#${location.index}`;
}

function pushList(
  rows: RenderRow[],
  list: readonly BlockNode[],
  container: StatementContainerPath,
  scriptIndex: number,
  path: readonly number[],
  depth: number,
  branchPath: readonly ("body" | "then" | "else")[] = [],
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
        ...(node.inputs?.condition === undefined ? {} : { condition: node.inputs.condition }),
        ...(node.inputs?.value === undefined ? {} : { value: node.inputs.value }),
        ...(node.inputs?.delta === undefined ? {} : { delta: node.inputs.delta }),
        ...(node.inputs?.index === undefined ? {} : { index: node.inputs.index }),
      },
    });
    const childPath = [...path, index];
    if (node.type === "control_repeat") {
      pushList(
        rows,
        node.inputs?.body ?? [],
        {
          kind: "repeatBody",
          scriptIndex,
          statementPath: childPath,
          branchPath: [...branchPath, "body"],
        },
        scriptIndex,
        childPath,
        depth + 1,
        [...branchPath, "body"],
      );
    } else if (node.type === "control_repeat_until") {
      pushList(
        rows,
        node.inputs?.body ?? [],
        {
          kind: "repeatUntilBody",
          scriptIndex,
          statementPath: childPath,
          branchPath: [...branchPath, "body"],
        },
        scriptIndex,
        childPath,
        depth + 1,
        [...branchPath, "body"],
      );
    } else if (node.type === "control_if") {
      pushList(
        rows,
        node.inputs?.then ?? [],
        {
          kind: "ifThen",
          scriptIndex,
          statementPath: childPath,
          branchPath: [...branchPath, "then"],
        },
        scriptIndex,
        childPath,
        depth + 1,
        [...branchPath, "then"],
      );
      rows.push({ kind: "elseBranch", scriptIndex, depth: depth + 1 });
      pushList(
        rows,
        node.inputs?.else ?? [],
        {
          kind: "ifElse",
          scriptIndex,
          statementPath: childPath,
          branchPath: [...branchPath, "else"],
        },
        scriptIndex,
        childPath,
        depth + 1,
        [...branchPath, "else"],
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

/** Derive keyboard nesting from the same canonical slots used by drag and drop. */
export function nestedMoveIntent(
  workspace: BlockWorkspaceSnapshot,
  location: StatementLocation,
  direction: "in" | "else" | "out",
): Extract<Intent, { type: "moveBlock" }> | undefined {
  const rows = toRows(workspace);
  const current = rows.find(
    (row) =>
      row.kind === "block" &&
      row.block.location.index === location.index &&
      sameContainer(row.block.location.container, location.container),
  );
  if (current?.kind !== "block") return undefined;
  if (direction === "out") {
    if (location.container.kind === "script") return undefined;
    const firstSlot = rows.findIndex(
      (row) =>
        row.kind === "slot" &&
        row.slot.index === 0 &&
        sameContainer(row.slot.container, location.container),
    );
    if (firstSlot < 0) return undefined;
    const parent = rows
      .slice(0, firstSlot)
      .reverse()
      .find((row) => row.kind === "block" && row.depth === current.depth - 1);
    if (parent?.kind !== "block") return undefined;
    return {
      type: "moveBlock",
      from: location,
      to: { container: parent.block.location.container, index: parent.block.location.index + 1 },
    };
  }
  if (location.index === 0) return undefined;
  const previous = rows.find(
    (row) =>
      row.kind === "block" &&
      row.block.location.index === location.index - 1 &&
      sameContainer(row.block.location.container, location.container),
  );
  if (previous?.kind !== "block") return undefined;
  const kind =
    direction === "else"
      ? previous.block.type === "control_if"
        ? "ifElse"
        : undefined
      : previous.block.type === "control_if"
        ? "ifThen"
        : previous.block.type === "control_repeat"
          ? "repeatBody"
          : previous.block.type === "control_repeat_until"
            ? "repeatUntilBody"
            : undefined;
  if (kind === undefined) return undefined;
  const container: StatementContainerPath = {
    kind,
    scriptIndex: location.container.scriptIndex,
    statementPath: [
      ...(location.container.kind === "script" ? [] : location.container.statementPath),
      location.index - 1,
    ],
    branchPath: [
      ...(location.container.kind === "script" ? [] : (location.container.branchPath ?? [])),
      kind === "ifThen" ? "then" : kind === "ifElse" ? "else" : "body",
    ],
  };
  const slots = rows.filter(
    (row) => row.kind === "slot" && sameContainer(row.slot.container, container),
  );
  const last = slots.at(-1);
  if (last?.kind !== "slot") return undefined;
  return { type: "moveBlock", from: location, to: { container, index: last.slot.index } };
}
