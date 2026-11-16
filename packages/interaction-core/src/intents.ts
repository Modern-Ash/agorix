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

function statementsAt(
  workspace: BlockWorkspaceSnapshot,
  container: StatementContainerPath,
): readonly BlockNode[] | undefined {
  let statements: readonly BlockNode[] | undefined =
    workspace.scripts[container.scriptIndex]?.statements;
  if (container.kind === "script") return statements;
  if (container.statementPath.length === 0) return undefined;
  if (
    container.branchPath !== undefined &&
    container.branchPath.length !== container.statementPath.length
  )
    return undefined;
  for (const [depth, index] of container.statementPath.entries()) {
    const parent: BlockNode | undefined = statements?.[index];
    if (parent === undefined) return undefined;
    const last = depth === container.statementPath.length - 1;
    const branch =
      container.branchPath?.[depth] ??
      (last
        ? container.kind === "ifThen"
          ? "then"
          : container.kind === "ifElse"
            ? "else"
            : "body"
        : parent.type === "control_if"
          ? "then"
          : "body");
    statements =
      branch === "body"
        ? parent.type === "control_repeat" || parent.type === "control_repeat_until"
          ? parent.inputs?.body
          : undefined
        : parent.type === "control_if"
          ? parent.inputs?.[branch]
          : undefined;
  }
  return statements;
}

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
      readonly actorId?: string;
    }
  | {
      readonly type: "setConditionNumber";
      readonly location: StatementLocation;
      readonly side: "left" | "right";
      readonly value: number;
    }
  | {
      readonly type: "setConditionBoolean";
      readonly location: StatementLocation;
      readonly value: boolean;
    }
  | {
      readonly type: "setConditionActor";
      readonly location: StatementLocation;
      readonly actorId: string;
    }
  | { readonly type: "addVariable"; readonly name: string }
  | { readonly type: "addList"; readonly name: string }
  | {
      readonly type: "setExpressionNumber";
      readonly location: StatementLocation;
      readonly input: "value" | "delta" | "index";
      readonly value: number;
    }
  | {
      readonly type: "setNumericInput";
      readonly location: StatementLocation;
      readonly input: "value" | "delta" | "index";
      readonly reporter:
        | "number"
        | "variable"
        | "listLength"
        | "listItem"
        | "xPosition"
        | "yPosition"
        | "distanceToActor"
        | "add"
        | "subtract"
        | "multiply"
        | "divide"
        | "modulo"
        | "random"
        | "randomInteger";
      readonly referenceId?: string;
      readonly itemIndex?: number;
    }
  | {
      readonly type: "setArithmeticOperand";
      readonly location: StatementLocation;
      readonly input: "value" | "delta" | "index";
      readonly side: "left" | "right" | "min" | "max";
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
    case "insertBlock": {
      const block = createDefaultBlock(intent.blockType, newBlockId());
      if (intent.blockType.startsWith("lists_")) {
        const listId = workspace?.lists?.[0]?.id;
        if (listId === undefined) return undefined;
        return {
          type: "addBlock",
          container: intent.to.container,
          index: intent.to.index,
          block: { ...block, fields: { ...block.fields, listId } },
        };
      }
      return {
        type: "addBlock",
        container: intent.to.container,
        index: intent.to.index,
        block,
      };
    }
    case "moveBlock":
      return { type: "moveBlock", from: intent.from, to: intent.to };
    case "deleteBlock":
      return { type: "deleteBlock", location: intent.location };
    case "addVariable": {
      const name = intent.name.trim();
      if (workspace === undefined || name.length < 1 || name.length > 40) return undefined;
      if (
        workspace.variables?.some((variable) => variable.name.toLowerCase() === name.toLowerCase())
      )
        return undefined;
      return {
        type: "addVariable",
        variable: { id: newBlockId(), name, initialValue: 0, visible: true },
      };
    }
    case "addList": {
      const name = intent.name.trim();
      if (workspace === undefined || name.length < 1 || name.length > 40) return undefined;
      if (workspace.lists?.some((list) => list.name.toLowerCase() === name.toLowerCase()))
        return undefined;
      return { type: "addList", list: { id: newBlockId(), name, initialItems: [], visible: true } };
    }
    case "setExpressionNumber": {
      if (workspace === undefined || !Number.isFinite(intent.value)) return undefined;
      const { container, index } = intent.location;
      const block = statementsAt(workspace, container)?.[index];
      const inputForType: Readonly<Record<string, readonly string[]>> = {
        variables_set: ["value"],
        variables_change: ["delta"],
        lists_add: ["value"],
        lists_remove_at: ["index"],
        lists_insert_at: ["index", "value"],
        lists_replace_at: ["index", "value"],
      };
      if (block === undefined || !inputForType[block.type]?.includes(intent.input))
        return undefined;
      const operand = block.inputs?.[intent.input];
      if (operand?.type !== "literal_number" || typeof operand.fields?.value !== "number")
        return undefined;
      return {
        type: "editBlock",
        location: intent.location,
        block: {
          ...block,
          inputs: {
            ...block.inputs,
            [intent.input]: { ...operand, fields: { ...operand.fields, value: intent.value } },
          },
        },
      };
    }
    case "setNumericInput": {
      if (workspace === undefined) return undefined;
      const { container, index } = intent.location;
      const block = statementsAt(workspace, container)?.[index];
      const supported: Readonly<Record<string, readonly string[]>> = {
        variables_set: ["value"],
        variables_change: ["delta"],
        lists_add: ["value"],
        lists_remove_at: ["index"],
        lists_insert_at: ["index", "value"],
        lists_replace_at: ["index", "value"],
      };
      if (block === undefined || !supported[block.type]?.includes(intent.input)) return undefined;
      const current = block.inputs?.[intent.input];
      if (current === undefined || Array.isArray(current)) return undefined;
      let replacement: BlockNode;
      switch (intent.reporter) {
        case "number":
          replacement = { id: current.id, type: "literal_number", fields: { value: 0 } };
          break;
        case "variable":
          if (!workspace.variables?.some((variable) => variable.id === intent.referenceId))
            return undefined;
          replacement = {
            id: current.id,
            type: "variables_value",
            fields: { variableId: intent.referenceId },
          };
          break;
        case "listLength":
          if (!workspace.lists?.some((list) => list.id === intent.referenceId)) return undefined;
          replacement = {
            id: current.id,
            type: "lists_length",
            fields: { listId: intent.referenceId },
          };
          break;
        case "listItem":
          if (
            !workspace.lists?.some((list) => list.id === intent.referenceId) ||
            !Number.isFinite(intent.itemIndex ?? 1)
          )
            return undefined;
          replacement = {
            id: current.id,
            type: "lists_item",
            fields: { listId: intent.referenceId },
            inputs: {
              index: {
                id: `${current.id}:index`,
                type: "literal_number",
                fields: { value: intent.itemIndex ?? 1 },
              },
            },
          };
          break;
        case "xPosition":
        case "yPosition":
          replacement = {
            id: current.id,
            type: intent.reporter === "xPosition" ? "sensing_x_position" : "sensing_y_position",
          };
          break;
        case "distanceToActor":
          if (!isSafeId(intent.referenceId)) return undefined;
          replacement = {
            id: current.id,
            type: "sensing_distance_to_actor",
            fields: { actorId: intent.referenceId },
          };
          break;
        case "add":
        case "subtract":
        case "multiply":
        case "divide":
        case "modulo":
          replacement = {
            id: current.id,
            type: `operator_${intent.reporter}`,
            inputs: {
              left: { id: `${current.id}:left`, type: "literal_number", fields: { value: 0 } },
              right: { id: `${current.id}:right`, type: "literal_number", fields: { value: 1 } },
            },
          };
          break;
        case "random":
        case "randomInteger":
          replacement = {
            id: current.id,
            type: intent.reporter === "random" ? "operator_random" : "operator_random_integer",
            inputs: {
              min: { id: `${current.id}:min`, type: "literal_number", fields: { value: 1 } },
              max: { id: `${current.id}:max`, type: "literal_number", fields: { value: 10 } },
            },
          };
          break;
      }
      return {
        type: "editBlock",
        location: intent.location,
        block: { ...block, inputs: { ...block.inputs, [intent.input]: replacement } },
      };
    }
    case "setArithmeticOperand": {
      if (workspace === undefined || !Number.isFinite(intent.value)) return undefined;
      const { container, index } = intent.location;
      const block = statementsAt(workspace, container)?.[index];
      const supported: Readonly<Record<string, readonly string[]>> = {
        variables_set: ["value"],
        variables_change: ["delta"],
        lists_add: ["value"],
        lists_remove_at: ["index"],
        lists_insert_at: ["index", "value"],
        lists_replace_at: ["index", "value"],
      };
      if (block === undefined || !supported[block.type]?.includes(intent.input)) return undefined;
      const expression = block.inputs?.[intent.input];
      if (
        expression === undefined ||
        Array.isArray(expression) ||
        ![
          "operator_add",
          "operator_subtract",
          "operator_multiply",
          "operator_divide",
          "operator_modulo",
          "operator_random",
          "operator_random_integer",
        ].includes(expression.type)
      )
        return undefined;
      const range =
        expression.type === "operator_random" || expression.type === "operator_random_integer";
      if (
        range
          ? intent.side !== "min" && intent.side !== "max"
          : intent.side !== "left" && intent.side !== "right"
      )
        return undefined;
      const operand = expression.inputs?.[intent.side];
      if (operand?.type !== "literal_number" || typeof operand.fields?.value !== "number")
        return undefined;
      return {
        type: "editBlock",
        location: intent.location,
        block: {
          ...block,
          inputs: {
            ...block.inputs,
            [intent.input]: {
              ...expression,
              inputs: {
                ...expression.inputs,
                [intent.side]: { ...operand, fields: { ...operand.fields, value: intent.value } },
              },
            },
          },
        },
      };
    }
    case "replaceCondition": {
      if (
        workspace === undefined ||
        !(STUDIO_CONDITION_BLOCK_TYPES as readonly string[]).includes(intent.blockType)
      )
        return undefined;
      const { container, index } = intent.location;
      const block = statementsAt(workspace, container)?.[index];
      if (block?.type !== "control_if" && block?.type !== "control_repeat_until") return undefined;
      const condition = createDefaultBlock(intent.blockType, newBlockId());
      if (
        intent.blockType === "sensing_touching_actor" &&
        intent.actorId !== undefined &&
        !isSafeId(intent.actorId)
      )
        return undefined;
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
        : intent.blockType === "sensing_touching_actor" && intent.actorId !== undefined
          ? { ...condition, fields: { ...condition.fields, actorId: intent.actorId } }
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
      const block = statementsAt(workspace, container)?.[index];
      const condition = block?.inputs?.condition;
      if (
        (block?.type !== "control_if" && block?.type !== "control_repeat_until") ||
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
    case "setConditionBoolean":
    case "setConditionActor": {
      if (workspace === undefined) return undefined;
      const { container, index } = intent.location;
      const block = statementsAt(workspace, container)?.[index];
      const condition = block?.inputs?.condition;
      if (
        (block?.type !== "control_if" && block?.type !== "control_repeat_until") ||
        condition === undefined
      )
        return undefined;
      if (intent.type === "setConditionBoolean" && condition.type !== "literal_boolean")
        return undefined;
      if (
        intent.type === "setConditionActor" &&
        (condition.type !== "sensing_touching_actor" || !isSafeId(intent.actorId))
      )
        return undefined;
      const fields =
        intent.type === "setConditionBoolean"
          ? { value: intent.value }
          : { actorId: intent.actorId };
      return {
        type: "editBlock",
        location: intent.location,
        block: {
          ...block,
          inputs: {
            ...block.inputs,
            condition: { ...condition, fields: { ...condition.fields, ...fields } },
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
      const block = statementsAt(workspace, container)?.[index];
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
