import {
  createDefaultBlock,
  type BlockType,
  type BlockWorkspaceSnapshot,
  type BlockNode,
  type StatementContainerPath,
  type StatementLocation,
  type WorkspaceChange,
} from "@agorix/block-editor";
import { isSafeId, parseAnchorRef, type AgentAnchorRef } from "./anchors.js";

export type AgentVerb = "explain" | "debug" | "challenge";

/** Boolean reporter blocks supported by Studio's first visual condition socket. */
export const STUDIO_CONDITION_BLOCK_TYPES = [
  "sensing_touching_goal",
  "sensing_touching_actor",
  "sensing_touching_stage_edge",
  "literal_boolean",
  "operator_less_than",
  "operator_greater_than",
  "operator_equals",
] as const satisfies readonly BlockType[];

export const STUDIO_COMPARISON_BLOCK_TYPES = [
  "operator_less_than",
  "operator_greater_than",
  "operator_equals",
] as const satisfies readonly BlockType[];

export interface InsertionPoint {
  readonly container: StatementContainerPath;
  readonly index: number;
}

export type DragSource =
  | { readonly kind: "palette"; readonly blockType: BlockType }
  | { readonly kind: "block"; readonly nodeId: string; readonly location: StatementLocation }
  | { readonly kind: "evidence"; readonly rowId: string; readonly nodeId: string }
  | { readonly kind: "codeSelection"; readonly nodeIds: readonly string[] }
  | { readonly kind: "proposal"; readonly proposalId: string };

export type DropTarget =
  | { readonly kind: "slot"; readonly to: InsertionPoint }
  | { readonly kind: "agent"; readonly verb: AgentVerb }
  | { readonly kind: "node"; readonly nodeId: string }
  | { readonly kind: "canvas" };

/**
 * Closed set of learner intents. There is deliberately no intent that accepts or applies a
 * proposal: dropping a proposal only ever opens review; acceptance is an explicit decision
 * handled by the host, never a gesture.
 */
export type Intent =
  | { readonly type: "insertBlock"; readonly blockType: BlockType; readonly to: InsertionPoint }
  | { readonly type: "moveBlock"; readonly from: StatementLocation; readonly to: InsertionPoint }
  | { readonly type: "deleteBlock"; readonly location: StatementLocation }
  | {
      readonly type: "setNumericField";
      readonly location: StatementLocation;
      readonly field: string;
      readonly value: number;
    }
  | {
      readonly type: "setTextField";
      readonly location: StatementLocation;
      readonly field: string;
      readonly value: string;
    }
  | {
      readonly type: "replaceCondition";
      readonly location: StatementLocation;
      readonly blockType: BlockType;
    }
  | {
      readonly type: "setConditionNumber";
      readonly location: StatementLocation;
      readonly side: "left" | "right";
      readonly value: number;
    }
  | { readonly type: "askAgent"; readonly verb: AgentVerb; readonly about: AgentAnchorRef }
  | { readonly type: "revealNode"; readonly nodeId: string }
  | { readonly type: "highlightNodes"; readonly nodeIds: readonly string[] }
  | { readonly type: "reviewProposal"; readonly proposalId: string };

function ask(verb: AgentVerb, about: AgentAnchorRef | undefined): Intent | undefined {
  return about === undefined ? undefined : { type: "askAgent", verb, about };
}

export function resolveDrop(source: DragSource, target: DropTarget): Intent | undefined {
  switch (source.kind) {
    case "palette":
      if (target.kind === "slot") {
        return { type: "insertBlock", blockType: source.blockType, to: target.to };
      }
      if (target.kind === "agent") {
        return ask(target.verb, parseAnchorRef({ kind: "paletteItem", id: source.blockType }));
      }
      return undefined;
    case "block":
      if (target.kind === "slot") {
        return { type: "moveBlock", from: source.location, to: target.to };
      }
      if (target.kind === "agent") {
        return ask(target.verb, parseAnchorRef({ kind: "node", id: source.nodeId }));
      }
      return undefined;
    case "evidence":
      if (target.kind === "canvas" || target.kind === "node") {
        return isSafeId(source.nodeId) ? { type: "revealNode", nodeId: source.nodeId } : undefined;
      }
      if (target.kind === "agent") {
        return ask(target.verb, parseAnchorRef({ kind: "evidenceRow", id: source.rowId }));
      }
      return undefined;
    case "codeSelection": {
      const ids = source.nodeIds;
      if (ids.length === 0 || !ids.every(isSafeId)) {
        return undefined;
      }
      if (target.kind === "canvas") {
        return { type: "highlightNodes", nodeIds: ids };
      }
      if (target.kind === "agent") {
        return ask(target.verb, parseAnchorRef({ kind: "node", id: ids[0] }));
      }
      return undefined;
    }
    case "proposal":
      if (!isSafeId(source.proposalId) || target.kind === "agent") {
        return undefined;
      }
      return { type: "reviewProposal", proposalId: source.proposalId };
  }
}

/**
 * Maps block-mutating intents to the existing canonical workspace change. Non-mutating intents
 * return undefined. The caller (host) applies the change and handles BlockEditorAdapterError.
 */
export function intentToChange(
  intent: Intent,
  newBlockId: () => string,
  workspace?: BlockWorkspaceSnapshot,
): WorkspaceChange | undefined {
  switch (intent.type) {
    case "insertBlock":
      return {
        type: "addBlock",
        container: intent.to.container,
        index: intent.to.index,
        block: createDefaultBlock(intent.blockType, newBlockId()),
      };
    case "moveBlock":
      return { type: "moveBlock", from: intent.from, to: intent.to };
    case "deleteBlock":
      return { type: "deleteBlock", location: intent.location };
    case "replaceCondition": {
      if (
        workspace === undefined ||
        !(STUDIO_CONDITION_BLOCK_TYPES as readonly string[]).includes(intent.blockType)
      )
        return undefined;
      const { container, index } = intent.location;
      let statements: readonly BlockNode[] | undefined =
        workspace.scripts[container.scriptIndex]?.statements;
      if (container.kind !== "script") {
        for (const pathIndex of container.statementPath) {
          const parent: BlockNode | undefined = statements?.[pathIndex];
          statements = parent?.type === "control_if" ? parent.inputs?.then : parent?.inputs?.body;
        }
      }
      const block = statements?.[index];
      if (block?.type !== "control_if") return undefined;
      const condition = createDefaultBlock(intent.blockType, newBlockId());
      const comparison = (STUDIO_COMPARISON_BLOCK_TYPES as readonly string[]).includes(
        intent.blockType,
      );
      const safeCondition = comparison
        ? {
            ...condition,
            inputs: {
              left: createDefaultBlock("literal_number", newBlockId()),
              right: {
                ...createDefaultBlock("literal_number", newBlockId()),
                fields: { value: 10 },
              },
            },
          }
        : condition;
      return {
        type: "editBlock",
        location: intent.location,
        block: {
          ...block,
          inputs: {
            ...block.inputs,
            condition: safeCondition,
          },
        },
      };
    }
    case "setConditionNumber": {
      if (workspace === undefined || !Number.isFinite(intent.value)) return undefined;
      const { container, index } = intent.location;
      let statements: readonly BlockNode[] | undefined =
        workspace.scripts[container.scriptIndex]?.statements;
      if (container.kind !== "script") {
        for (const pathIndex of container.statementPath) {
          const parent: BlockNode | undefined = statements?.[pathIndex];
          statements = parent?.type === "control_if" ? parent.inputs?.then : parent?.inputs?.body;
        }
      }
      const block = statements?.[index];
      const condition = block?.inputs?.condition;
      if (
        block?.type !== "control_if" ||
        condition === undefined ||
        !(STUDIO_COMPARISON_BLOCK_TYPES as readonly string[]).includes(condition.type)
      )
        return undefined;
      const operand = condition.inputs?.[intent.side];
      if (operand?.type !== "literal_number" || typeof operand.fields?.value !== "number")
        return undefined;
      return {
        type: "editBlock",
        location: intent.location,
        block: {
          ...block,
          inputs: {
            ...block.inputs,
            condition: {
              ...condition,
              inputs: {
                ...condition.inputs,
                [intent.side]: { ...operand, fields: { ...operand.fields, value: intent.value } },
              },
            },
          },
        },
      };
    }
    case "setNumericField":
    case "setTextField": {
      if (
        workspace === undefined ||
        (intent.type === "setNumericField" && !Number.isFinite(intent.value)) ||
        (intent.type === "setTextField" && intent.value.length > 160)
      )
        return undefined;
      const { container, index } = intent.location;
      let statements: readonly BlockNode[] | undefined =
        workspace.scripts[container.scriptIndex]?.statements;
      if (container.kind !== "script") {
        for (const pathIndex of container.statementPath) {
          const parent: BlockNode | undefined = statements?.[pathIndex];
          statements = parent?.type === "control_if" ? parent.inputs?.then : parent?.inputs?.body;
        }
      }
      const block = statements?.[index];
      if (block === undefined || typeof block.fields?.[intent.field] !== typeof intent.value)
        return undefined;
      return {
        type: "editBlock",
        location: intent.location,
        block: { ...block, fields: { ...block.fields, [intent.field]: intent.value } },
      };
    }
    default:
      return undefined;
  }
}
