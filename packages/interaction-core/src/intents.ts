import {
  createDefaultBlock,
  type BlockType,
  type BlockWorkspaceSnapshot,
  type BlockNode,
  type StatementContainerPath,
  type StatementLocation,
  type WorkspaceChange,
} from "@agorix/block-editor";
import {
  LIST_MAX_ITEMS,
  NUMERIC_LITERAL_MIN,
  NUMERIC_LITERAL_MAX,
  type MathFunction,
} from "@agorix/program-model";
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
  "operator_less_or_equal",
  "operator_greater_or_equal",
  "operator_equals",
  "operator_and",
  "operator_or",
  "operator_not",
] as const satisfies readonly BlockType[];

export const STUDIO_LOGICAL_OPERAND_TYPES = [
  "literal_boolean",
  "sensing_touching_goal",
  "sensing_touching_actor",
  "sensing_touching_stage_edge",
  "operator_less_than",
  "operator_greater_than",
  "operator_less_or_equal",
  "operator_greater_or_equal",
  "operator_equals",
] as const satisfies readonly BlockType[];

export const STUDIO_COMPARISON_BLOCK_TYPES = [
  "operator_less_than",
  "operator_greater_than",
  "operator_less_or_equal",
  "operator_greater_or_equal",
  "operator_equals",
] as const satisfies readonly BlockType[];

export const STUDIO_COMPARISON_OPERAND_SOURCES = [
  "number",
  "variable",
  "listLength",
  "listItem",
  "xPosition",
  "yPosition",
  "distanceToActor",
  "randomInteger",
  "mathFunction",
] as const;

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
  | {
      readonly type: "createProcedure";
      readonly scriptIndex: number;
      readonly name: string;
      readonly count: number;
    }
  | {
      readonly type: "renameProcedure";
      readonly scriptIndex: number;
      readonly procedureId: string;
      readonly name: string;
    }
  | {
      readonly type: "deleteProcedure";
      readonly scriptIndex: number;
      readonly procedureId: string;
      readonly inlineCalls: boolean;
    }
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
      readonly type: "setComparisonOperand";
      readonly location: StatementLocation;
      readonly side: "left" | "right";
      readonly source: (typeof STUDIO_COMPARISON_OPERAND_SOURCES)[number];
      readonly referenceId?: string;
    }
  | {
      readonly type: "setComparisonNestedNumber";
      readonly location: StatementLocation;
      readonly side: "left" | "right";
      readonly field: "index" | "min" | "max" | "value";
      readonly value: number;
    }
  | {
      readonly type: "setComparisonMathFunction";
      readonly location: StatementLocation;
      readonly side: "left" | "right";
      readonly logicalSide?: "left" | "right" | "value";
      readonly function: MathFunction;
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
  | {
      readonly type: "setLogicalOperand";
      readonly location: StatementLocation;
      readonly side: "left" | "right" | "value";
      readonly blockType: (typeof STUDIO_LOGICAL_OPERAND_TYPES)[number];
      readonly actorId?: string;
    }
  | {
      readonly type: "setLogicalActor";
      readonly location: StatementLocation;
      readonly side: "left" | "right" | "value";
      readonly actorId: string;
    }
  | {
      readonly type: "setLogicalBoolean";
      readonly location: StatementLocation;
      readonly side: "left" | "right" | "value";
      readonly value: boolean;
    }
  | {
      readonly type: "setLogicalComparisonNumber";
      readonly location: StatementLocation;
      readonly side: "left" | "right" | "value";
      readonly operand: "left" | "right";
      readonly value: number;
    }
  | {
      readonly type: "setLogicalComparisonSource";
      readonly location: StatementLocation;
      readonly side: "left" | "right" | "value";
      readonly operand: "left" | "right";
      readonly source: (typeof STUDIO_COMPARISON_OPERAND_SOURCES)[number];
      readonly referenceId?: string;
    }
  | {
      readonly type: "setLogicalComparisonNestedNumber";
      readonly location: StatementLocation;
      readonly side: "left" | "right" | "value";
      readonly operand: "left" | "right";
      readonly field: "index" | "min" | "max" | "value";
      readonly value: number;
    }
  | { readonly type: "addVariable"; readonly name: string }
  | { readonly type: "renameVariable"; readonly variableId: string; readonly name: string }
  | { readonly type: "deleteVariable"; readonly variableId: string }
  | {
      readonly type: "setVariableInitialValue";
      readonly variableId: string;
      readonly value: number;
    }
  | { readonly type: "setVariableVisible"; readonly variableId: string; readonly visible: boolean }
  | { readonly type: "addList"; readonly name: string }
  | { readonly type: "renameList"; readonly listId: string; readonly name: string }
  | { readonly type: "deleteList"; readonly listId: string }
  | { readonly type: "setListVisible"; readonly listId: string; readonly visible: boolean }
  | {
      readonly type: "setListInitialItems";
      readonly listId: string;
      readonly items: readonly number[];
    }
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
        | "randomInteger"
        | "mathFunction";
      readonly referenceId?: string;
      readonly itemIndex?: number;
    }
  | {
      readonly type: "setMathFunction";
      readonly location: StatementLocation;
      readonly input: "value" | "delta" | "index";
      readonly function: MathFunction;
      readonly value?: number;
    }
  | {
      readonly type: "setMathFunctionSource";
      readonly location: StatementLocation;
      readonly input: "value" | "delta" | "index";
      readonly reporter:
        "number" | "variable" | "listLength" | "xPosition" | "yPosition" | "distanceToActor";
      readonly referenceId?: string;
    }
  | {
      readonly type: "setArithmeticOperand";
      readonly location: StatementLocation;
      readonly input: "value" | "delta" | "index";
      readonly side: "left" | "right" | "min" | "max" | "value";
      readonly value: number;
      readonly path?: readonly ("left" | "right" | "min" | "max")[];
    }
  | {
      readonly type: "setArithmeticOperandSource";
      readonly location: StatementLocation;
      readonly input: "value" | "delta" | "index";
      readonly side: "left" | "right" | "min" | "max";
      readonly reporter:
        | "number"
        | "variable"
        | "listLength"
        | "xPosition"
        | "yPosition"
        | "distanceToActor"
        | "add"
        | "subtract"
        | "multiply"
        | "divide"
        | "modulo"
        | "random"
        | "randomInteger"
        | "mathFunction";
      readonly referenceId?: string;
    }
  | {
      readonly type: "setArithmeticMathFunction";
      readonly location: StatementLocation;
      readonly input: "value" | "delta" | "index";
      readonly side: "left" | "right" | "min" | "max";
      readonly function: MathFunction;
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
      if (intent.blockType === "procedures_call") {
        const procedureId =
          workspace?.scripts[intent.to.container.scriptIndex]?.procedures?.[0]?.id;
        if (procedureId === undefined) return undefined;
        return {
          type: "addBlock",
          container: intent.to.container,
          index: intent.to.index,
          block: { ...block, fields: { procedureId } },
        };
      }
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
    case "renameVariable": {
      const name = intent.name.trim();
      if (
        workspace === undefined ||
        !isSafeId(intent.variableId) ||
        name.length < 1 ||
        name.length > 40 ||
        !workspace.variables?.some((variable) => variable.id === intent.variableId) ||
        workspace.variables.some(
          (variable) =>
            variable.id !== intent.variableId && variable.name.toLowerCase() === name.toLowerCase(),
        )
      )
        return undefined;
      return { type: "renameVariable", variableId: intent.variableId, name };
    }
    case "deleteVariable": {
      if (
        workspace === undefined ||
        !isSafeId(intent.variableId) ||
        !workspace.variables?.some((variable) => variable.id === intent.variableId)
      )
        return undefined;
      return { type: "deleteVariable", variableId: intent.variableId };
    }
    case "setVariableInitialValue": {
      if (
        workspace === undefined ||
        !isSafeId(intent.variableId) ||
        !workspace.variables?.some((variable) => variable.id === intent.variableId) ||
        !Number.isFinite(intent.value) ||
        intent.value < NUMERIC_LITERAL_MIN ||
        intent.value > NUMERIC_LITERAL_MAX
      )
        return undefined;
      return {
        type: "editVariableInitialValue",
        variableId: intent.variableId,
        value: intent.value,
      };
    }
    case "setVariableVisible": {
      if (
        workspace === undefined ||
        !isSafeId(intent.variableId) ||
        !workspace.variables?.some((variable) => variable.id === intent.variableId) ||
        typeof intent.visible !== "boolean"
      )
        return undefined;
      return {
        type: "editVariableVisibility",
        variableId: intent.variableId,
        visible: intent.visible,
      };
    }
    case "addList": {
      const name = intent.name.trim();
      if (workspace === undefined || name.length < 1 || name.length > 40) return undefined;
      if (workspace.lists?.some((list) => list.name.toLowerCase() === name.toLowerCase()))
        return undefined;
      return { type: "addList", list: { id: newBlockId(), name, initialItems: [], visible: true } };
    }
    case "renameList": {
      const name = intent.name.trim();
      if (
        workspace === undefined ||
        !isSafeId(intent.listId) ||
        name.length < 1 ||
        name.length > 40 ||
        !workspace.lists?.some((list) => list.id === intent.listId) ||
        workspace.lists.some(
          (list) => list.id !== intent.listId && list.name.toLowerCase() === name.toLowerCase(),
        )
      )
        return undefined;
      return { type: "renameList", listId: intent.listId, name };
    }
    case "deleteList": {
      if (
        workspace === undefined ||
        !isSafeId(intent.listId) ||
        !workspace.lists?.some((list) => list.id === intent.listId)
      )
        return undefined;
      return { type: "deleteList", listId: intent.listId };
    }
    case "setListVisible": {
      if (
        workspace === undefined ||
        !isSafeId(intent.listId) ||
        !workspace.lists?.some((list) => list.id === intent.listId) ||
        typeof intent.visible !== "boolean"
      )
        return undefined;
      return { type: "editListVisibility", listId: intent.listId, visible: intent.visible };
    }
    case "setListInitialItems": {
      if (
        workspace === undefined ||
        !isSafeId(intent.listId) ||
        !workspace.lists?.some((list) => list.id === intent.listId) ||
        !Array.isArray(intent.items) ||
        intent.items.length > LIST_MAX_ITEMS ||
        intent.items.some(
          (item) =>
            !Number.isFinite(item) || item < NUMERIC_LITERAL_MIN || item > NUMERIC_LITERAL_MAX,
        )
      )
        return undefined;
      return { type: "editListInitialItems", listId: intent.listId, items: intent.items };
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
        case "mathFunction":
          replacement = {
            id: current.id,
            type: "operator_math_function",
            fields: { function: "abs" },
            inputs: {
              value: { id: `${current.id}:value`, type: "literal_number", fields: { value: 0 } },
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
    case "setMathFunction": {
      if (
        workspace === undefined ||
        !(["abs", "round", "floor", "ceiling"] as readonly string[]).includes(intent.function) ||
        (intent.value !== undefined &&
          (!Number.isFinite(intent.value) ||
            intent.value < NUMERIC_LITERAL_MIN ||
            intent.value > NUMERIC_LITERAL_MAX))
      )
        return undefined;
      const block = statementsAt(workspace, intent.location.container)?.[intent.location.index];
      const supported: Readonly<Record<string, readonly string[]>> = {
        variables_set: ["value"],
        variables_change: ["delta"],
        lists_add: ["value"],
        lists_remove_at: ["index"],
        lists_insert_at: ["index", "value"],
        lists_replace_at: ["index", "value"],
      };
      if (block === undefined || !supported[block.type]?.includes(intent.input)) return undefined;
      const operand = block.inputs?.[intent.input];
      if (
        operand === undefined ||
        Array.isArray(operand) ||
        operand.type !== "operator_math_function"
      )
        return undefined;
      const value = operand.inputs?.value;
      if (
        intent.value !== undefined &&
        (value === undefined || Array.isArray(value) || value.type !== "literal_number")
      )
        return undefined;
      return {
        type: "editBlock",
        location: intent.location,
        block: {
          ...block,
          inputs: {
            ...block.inputs,
            [intent.input]: {
              ...operand,
              fields: { ...operand.fields, function: intent.function },
              ...(intent.value === undefined || value === undefined || Array.isArray(value)
                ? {}
                : {
                    inputs: {
                      ...operand.inputs,
                      value: { ...value, fields: { ...value.fields, value: intent.value } },
                    },
                  }),
            },
          },
        },
      };
    }
    case "setMathFunctionSource": {
      if (workspace === undefined) return undefined;
      const block = statementsAt(workspace, intent.location.container)?.[intent.location.index];
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
        expression.type !== "operator_math_function"
      )
        return undefined;
      const current = expression.inputs?.value;
      if (current === undefined || Array.isArray(current)) return undefined;
      let replacement: BlockNode;
      switch (intent.reporter) {
        case "number":
          replacement = { id: current.id, type: "literal_number", fields: { value: 0 } };
          break;
        case "variable":
          if (!workspace.variables?.some((item) => item.id === intent.referenceId))
            return undefined;
          replacement = {
            id: current.id,
            type: "variables_value",
            fields: { variableId: intent.referenceId },
          };
          break;
        case "listLength":
          if (!workspace.lists?.some((item) => item.id === intent.referenceId)) return undefined;
          replacement = {
            id: current.id,
            type: "lists_length",
            fields: { listId: intent.referenceId },
          };
          break;
        case "xPosition":
          replacement = { id: current.id, type: "sensing_x_position" };
          break;
        case "yPosition":
          replacement = { id: current.id, type: "sensing_y_position" };
          break;
        case "distanceToActor":
          if (!isSafeId(intent.referenceId)) return undefined;
          replacement = {
            id: current.id,
            type: "sensing_distance_to_actor",
            fields: { actorId: intent.referenceId },
          };
          break;
        default:
          return undefined;
      }
      return {
        type: "editBlock",
        location: intent.location,
        block: {
          ...block,
          inputs: {
            ...block.inputs,
            [intent.input]: {
              ...expression,
              inputs: { ...expression.inputs, value: replacement },
            },
          },
        },
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
      const rootExpression = block.inputs?.[intent.input];
      if (
        intent.path !== undefined &&
        (intent.path.length !== 1 || rootExpression === undefined || Array.isArray(rootExpression))
      )
        return undefined;
      const parentSide = intent.path?.[0];
      if (
        parentSide !== undefined &&
        rootExpression !== undefined &&
        !Array.isArray(rootExpression)
      ) {
        const rootRange =
          rootExpression.type === "operator_random" ||
          rootExpression.type === "operator_random_integer";
        if (
          rootRange
            ? parentSide !== "min" && parentSide !== "max"
            : parentSide !== "left" && parentSide !== "right"
        )
          return undefined;
      }
      const expression =
        parentSide === undefined
          ? rootExpression
          : rootExpression !== undefined && !Array.isArray(rootExpression)
            ? rootExpression.inputs?.[parentSide]
            : undefined;
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
          "operator_math_function",
        ].includes(expression.type)
      )
        return undefined;
      const range =
        expression.type === "operator_random" || expression.type === "operator_random_integer";
      if (
        expression.type === "operator_math_function"
          ? intent.side !== "value"
          : range
            ? intent.side !== "min" && intent.side !== "max"
            : intent.side !== "left" && intent.side !== "right"
      )
        return undefined;
      const operand = expression.inputs?.[intent.side];
      if (operand?.type !== "literal_number" || typeof operand.fields?.value !== "number")
        return undefined;
      const nextExpression = {
        ...expression,
        inputs: {
          ...expression.inputs,
          [intent.side]: { ...operand, fields: { ...operand.fields, value: intent.value } },
        },
      };
      const nextRoot =
        parentSide === undefined
          ? nextExpression
          : {
              ...rootExpression,
              inputs: { ...rootExpression?.inputs, [parentSide]: nextExpression },
            };
      return {
        type: "editBlock",
        location: intent.location,
        block: {
          ...block,
          inputs: {
            ...block.inputs,
            [intent.input]: nextRoot,
          },
        },
      };
    }
    case "setArithmeticOperandSource": {
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
      const current = expression.inputs?.[intent.side];
      if (current === undefined || Array.isArray(current)) return undefined;
      let replacement: BlockNode;
      switch (intent.reporter) {
        case "number":
          replacement = { id: current.id, type: "literal_number", fields: { value: 0 } };
          break;
        case "variable":
          if (!workspace.variables?.some((item) => item.id === intent.referenceId))
            return undefined;
          replacement = {
            id: current.id,
            type: "variables_value",
            fields: { variableId: intent.referenceId },
          };
          break;
        case "listLength":
          if (!workspace.lists?.some((item) => item.id === intent.referenceId)) return undefined;
          replacement = {
            id: current.id,
            type: "lists_length",
            fields: { listId: intent.referenceId },
          };
          break;
        case "xPosition":
          replacement = { id: current.id, type: "sensing_x_position" };
          break;
        case "yPosition":
          replacement = { id: current.id, type: "sensing_y_position" };
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
        case "random":
        case "randomInteger":
          replacement = {
            id: current.id,
            type: `operator_${intent.reporter === "randomInteger" ? "random_integer" : intent.reporter}`,
            inputs: {
              ...(intent.reporter === "random" || intent.reporter === "randomInteger"
                ? {
                    min: {
                      id: `${current.id}:min`,
                      type: "literal_number" as const,
                      fields: { value: 0 },
                    },
                    max: {
                      id: `${current.id}:max`,
                      type: "literal_number" as const,
                      fields: { value: 10 },
                    },
                  }
                : {
                    left: {
                      id: `${current.id}:left`,
                      type: "literal_number" as const,
                      fields: { value: 0 },
                    },
                    right: {
                      id: `${current.id}:right`,
                      type: "literal_number" as const,
                      fields: { value: 1 },
                    },
                  }),
            },
          };
          break;
        case "mathFunction":
          replacement = {
            id: current.id,
            type: "operator_math_function",
            fields: { function: "abs" },
            inputs: {
              value: { id: `${current.id}:value`, type: "literal_number", fields: { value: 0 } },
            },
          };
          break;
      }
      return {
        type: "editBlock",
        location: intent.location,
        block: {
          ...block,
          inputs: {
            ...block.inputs,
            [intent.input]: {
              ...expression,
              inputs: { ...expression.inputs, [intent.side]: replacement },
            },
          },
        },
      };
    }
    case "setArithmeticMathFunction": {
      if (
        workspace === undefined ||
        !(["abs", "round", "floor", "ceiling"] as readonly string[]).includes(intent.function)
      )
        return undefined;
      const block = statementsAt(workspace, intent.location.container)?.[intent.location.index];
      const supported: Readonly<Record<string, readonly string[]>> = {
        variables_set: ["value"],
        variables_change: ["delta"],
        lists_add: ["value"],
        lists_remove_at: ["index"],
        lists_insert_at: ["index", "value"],
        lists_replace_at: ["index", "value"],
      };
      if (block === undefined || !supported[block.type]?.includes(intent.input)) return undefined;
      const root = block.inputs?.[intent.input];
      if (
        root === undefined ||
        Array.isArray(root) ||
        ![
          "operator_add",
          "operator_subtract",
          "operator_multiply",
          "operator_divide",
          "operator_modulo",
          "operator_random",
          "operator_random_integer",
        ].includes(root.type)
      )
        return undefined;
      const range = root.type === "operator_random" || root.type === "operator_random_integer";
      if (
        range
          ? intent.side !== "min" && intent.side !== "max"
          : intent.side !== "left" && intent.side !== "right"
      )
        return undefined;
      const operand = root.inputs?.[intent.side];
      if (
        operand === undefined ||
        Array.isArray(operand) ||
        operand.type !== "operator_math_function"
      )
        return undefined;
      return {
        type: "editBlock",
        location: intent.location,
        block: {
          ...block,
          inputs: {
            ...block.inputs,
            [intent.input]: {
              ...root,
              inputs: {
                ...root.inputs,
                [intent.side]: {
                  ...operand,
                  fields: { ...operand.fields, function: intent.function },
                },
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
    case "setLogicalOperand":
    case "setLogicalBoolean":
    case "setLogicalActor": {
      if (workspace === undefined) return undefined;
      const block = statementsAt(workspace, intent.location.container)?.[intent.location.index];
      const condition = block?.inputs?.condition;
      if (
        (block?.type !== "control_if" && block?.type !== "control_repeat_until") ||
        condition === undefined ||
        Array.isArray(condition) ||
        !["operator_and", "operator_or", "operator_not"].includes(condition.type) ||
        (condition.type === "operator_not" ? intent.side !== "value" : intent.side === "value")
      )
        return undefined;
      const current = condition.inputs?.[intent.side];
      if (current === undefined || Array.isArray(current)) return undefined;
      if (intent.type === "setLogicalBoolean" && current.type !== "literal_boolean")
        return undefined;
      if (intent.type === "setLogicalActor" && current.type !== "sensing_touching_actor")
        return undefined;
      if (
        (intent.type === "setLogicalActor" ||
          (intent.type === "setLogicalOperand" && intent.actorId !== undefined)) &&
        !isSafeId(intent.actorId ?? "")
      )
        return undefined;
      const next =
        intent.type === "setLogicalOperand"
          ? {
              ...createDefaultBlock(intent.blockType, current.id),
              id: current.id,
              ...((STUDIO_COMPARISON_BLOCK_TYPES as readonly string[]).includes(intent.blockType)
                ? {
                    inputs: {
                      left: {
                        id: `${current.id}:left`,
                        type: "literal_number" as const,
                        fields: { value: 0 },
                      },
                      right: {
                        id: `${current.id}:right`,
                        type: "literal_number" as const,
                        fields: { value: 10 },
                      },
                    },
                  }
                : {}),
              ...(intent.blockType === "sensing_touching_actor" && intent.actorId !== undefined
                ? { fields: { actorId: intent.actorId } }
                : {}),
            }
          : {
              ...current,
              fields: {
                ...current.fields,
                ...(intent.type === "setLogicalBoolean"
                  ? { value: intent.value }
                  : { actorId: intent.actorId }),
              },
            };
      return {
        type: "editBlock",
        location: intent.location,
        block: {
          ...block,
          inputs: {
            ...block.inputs,
            condition: { ...condition, inputs: { ...condition.inputs, [intent.side]: next } },
          },
        },
      };
    }
    case "setLogicalComparisonNumber": {
      if (workspace === undefined || !Number.isFinite(intent.value)) return undefined;
      const block = statementsAt(workspace, intent.location.container)?.[intent.location.index];
      const condition = block?.inputs?.condition;
      if (
        (block?.type !== "control_if" && block?.type !== "control_repeat_until") ||
        condition === undefined ||
        Array.isArray(condition) ||
        !["operator_and", "operator_or", "operator_not"].includes(condition.type) ||
        (condition.type === "operator_not" ? intent.side !== "value" : intent.side === "value")
      )
        return undefined;
      const comparison = condition.inputs?.[intent.side];
      if (
        comparison === undefined ||
        Array.isArray(comparison) ||
        !(STUDIO_COMPARISON_BLOCK_TYPES as readonly string[]).includes(comparison.type)
      )
        return undefined;
      const current = comparison.inputs?.[intent.operand];
      if (
        current === undefined ||
        Array.isArray(current) ||
        current.type !== "literal_number" ||
        typeof current.fields?.value !== "number"
      )
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
                [intent.side]: {
                  ...comparison,
                  inputs: {
                    ...comparison.inputs,
                    [intent.operand]: {
                      ...current,
                      fields: { ...current.fields, value: intent.value },
                    },
                  },
                },
              },
            },
          },
        },
      };
    }
    case "setLogicalComparisonSource":
    case "setLogicalComparisonNestedNumber": {
      if (workspace === undefined) return undefined;
      if (intent.type === "setLogicalComparisonSource") {
        if (!(STUDIO_COMPARISON_OPERAND_SOURCES as readonly string[]).includes(intent.source))
          return undefined;
      } else if (!Number.isFinite(intent.value)) return undefined;
      const block = statementsAt(workspace, intent.location.container)?.[intent.location.index];
      const condition = block?.inputs?.condition;
      if (
        (block?.type !== "control_if" && block?.type !== "control_repeat_until") ||
        condition === undefined ||
        Array.isArray(condition) ||
        !["operator_and", "operator_or", "operator_not"].includes(condition.type) ||
        (condition.type === "operator_not" ? intent.side !== "value" : intent.side === "value")
      )
        return undefined;
      const comparison = condition.inputs?.[intent.side];
      if (
        comparison === undefined ||
        Array.isArray(comparison) ||
        !(STUDIO_COMPARISON_BLOCK_TYPES as readonly string[]).includes(comparison.type)
      )
        return undefined;
      const current = comparison.inputs?.[intent.operand];
      if (current === undefined || Array.isArray(current)) return undefined;
      let next: BlockNode;
      if (intent.type === "setLogicalComparisonNestedNumber") {
        if (
          current.type === "lists_item"
            ? intent.field !== "index"
            : current.type === "operator_random_integer"
              ? intent.field !== "min" && intent.field !== "max"
              : current.type === "operator_math_function"
                ? intent.field !== "value"
                : true
        )
          return undefined;
        const nested = current.inputs?.[intent.field];
        if (nested === undefined || Array.isArray(nested) || nested.type !== "literal_number")
          return undefined;
        next = {
          ...current,
          inputs: {
            ...current.inputs,
            [intent.field]: { ...nested, fields: { ...nested.fields, value: intent.value } },
          },
        };
      } else {
        switch (intent.source) {
          case "number":
            next = { id: current.id, type: "literal_number", fields: { value: 0 } };
            break;
          case "variable":
            if (!workspace.variables?.some((entry) => entry.id === intent.referenceId))
              return undefined;
            next = {
              id: current.id,
              type: "variables_value",
              fields: { variableId: intent.referenceId },
            };
            break;
          case "listLength":
          case "listItem":
            if (!workspace.lists?.some((entry) => entry.id === intent.referenceId))
              return undefined;
            next =
              intent.source === "listLength"
                ? { id: current.id, type: "lists_length", fields: { listId: intent.referenceId } }
                : {
                    id: current.id,
                    type: "lists_item",
                    fields: { listId: intent.referenceId },
                    inputs: {
                      index: {
                        id: `${current.id}:index`,
                        type: "literal_number",
                        fields: { value: 1 },
                      },
                    },
                  };
            break;
          case "xPosition":
          case "yPosition":
            next = {
              id: current.id,
              type: intent.source === "xPosition" ? "sensing_x_position" : "sensing_y_position",
            };
            break;
          case "distanceToActor":
            if (intent.referenceId === undefined || !isSafeId(intent.referenceId)) return undefined;
            next = {
              id: current.id,
              type: "sensing_distance_to_actor",
              fields: { actorId: intent.referenceId },
            };
            break;
          case "randomInteger":
            next = {
              id: current.id,
              type: "operator_random_integer",
              inputs: {
                min: { id: `${current.id}:min`, type: "literal_number", fields: { value: 1 } },
                max: { id: `${current.id}:max`, type: "literal_number", fields: { value: 10 } },
              },
            };
            break;
          case "mathFunction":
            next = {
              id: current.id,
              type: "operator_math_function",
              fields: { function: "abs" },
              inputs: {
                value: { id: `${current.id}:value`, type: "literal_number", fields: { value: 0 } },
              },
            };
            break;
        }
      }
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
                [intent.side]: {
                  ...comparison,
                  inputs: { ...comparison.inputs, [intent.operand]: next },
                },
              },
            },
          },
        },
      };
    }
    case "setComparisonOperand": {
      if (
        workspace === undefined ||
        !(STUDIO_COMPARISON_OPERAND_SOURCES as readonly string[]).includes(intent.source)
      )
        return undefined;
      const block = statementsAt(workspace, intent.location.container)?.[intent.location.index];
      const condition = block?.inputs?.condition;
      if (
        (block?.type !== "control_if" && block?.type !== "control_repeat_until") ||
        condition === undefined ||
        Array.isArray(condition) ||
        !(STUDIO_COMPARISON_BLOCK_TYPES as readonly string[]).includes(condition.type)
      )
        return undefined;
      const current = condition.inputs?.[intent.side];
      if (current === undefined || Array.isArray(current)) return undefined;
      let next: BlockNode;
      switch (intent.source) {
        case "number":
          next = { id: current.id, type: "literal_number", fields: { value: 0 } };
          break;
        case "variable":
          if (!workspace.variables?.some((entry) => entry.id === intent.referenceId))
            return undefined;
          next = {
            id: current.id,
            type: "variables_value",
            fields: { variableId: intent.referenceId },
          };
          break;
        case "listLength":
          if (!workspace.lists?.some((entry) => entry.id === intent.referenceId)) return undefined;
          next = { id: current.id, type: "lists_length", fields: { listId: intent.referenceId } };
          break;
        case "listItem":
          if (!workspace.lists?.some((entry) => entry.id === intent.referenceId)) return undefined;
          next = {
            id: current.id,
            type: "lists_item",
            fields: { listId: intent.referenceId },
            inputs: {
              index: { id: `${current.id}:index`, type: "literal_number", fields: { value: 1 } },
            },
          };
          break;
        case "xPosition":
        case "yPosition":
          next = {
            id: current.id,
            type: intent.source === "xPosition" ? "sensing_x_position" : "sensing_y_position",
          };
          break;
        case "distanceToActor":
          if (intent.referenceId === undefined || !isSafeId(intent.referenceId)) return undefined;
          next = {
            id: current.id,
            type: "sensing_distance_to_actor",
            fields: { actorId: intent.referenceId },
          };
          break;
        case "randomInteger":
          next = {
            id: current.id,
            type: "operator_random_integer",
            inputs: {
              min: { id: `${current.id}:min`, type: "literal_number", fields: { value: 1 } },
              max: { id: `${current.id}:max`, type: "literal_number", fields: { value: 10 } },
            },
          };
          break;
        case "mathFunction":
          next = {
            id: current.id,
            type: "operator_math_function",
            fields: { function: "abs" },
            inputs: {
              value: { id: `${current.id}:value`, type: "literal_number", fields: { value: 0 } },
            },
          };
          break;
      }
      return {
        type: "editBlock",
        location: intent.location,
        block: {
          ...block,
          inputs: {
            ...block.inputs,
            condition: { ...condition, inputs: { ...condition.inputs, [intent.side]: next } },
          },
        },
      };
    }
    case "setComparisonMathFunction": {
      if (
        workspace === undefined ||
        !(["abs", "round", "floor", "ceiling"] as readonly string[]).includes(intent.function)
      )
        return undefined;
      const block = statementsAt(workspace, intent.location.container)?.[intent.location.index];
      const condition = block?.inputs?.condition;
      if (
        (block?.type !== "control_if" && block?.type !== "control_repeat_until") ||
        condition === undefined ||
        Array.isArray(condition)
      )
        return undefined;
      let comparison: BlockNode;
      if (intent.logicalSide === undefined) comparison = condition;
      else {
        if (
          !["operator_and", "operator_or", "operator_not"].includes(condition.type) ||
          (condition.type === "operator_not"
            ? intent.logicalSide !== "value"
            : intent.logicalSide === "value")
        )
          return undefined;
        const nested = condition.inputs?.[intent.logicalSide];
        if (nested === undefined || Array.isArray(nested)) return undefined;
        comparison = nested;
      }
      if (!(STUDIO_COMPARISON_BLOCK_TYPES as readonly string[]).includes(comparison.type))
        return undefined;
      const operand = comparison.inputs?.[intent.side];
      if (
        operand === undefined ||
        Array.isArray(operand) ||
        operand.type !== "operator_math_function"
      )
        return undefined;
      const nextComparison = {
        ...comparison,
        inputs: {
          ...comparison.inputs,
          [intent.side]: { ...operand, fields: { ...operand.fields, function: intent.function } },
        },
      };
      return {
        type: "editBlock",
        location: intent.location,
        block: {
          ...block,
          inputs: {
            ...block.inputs,
            condition:
              intent.logicalSide === undefined
                ? nextComparison
                : {
                    ...condition,
                    inputs: { ...condition.inputs, [intent.logicalSide]: nextComparison },
                  },
          },
        },
      };
    }
    case "setComparisonNestedNumber": {
      if (workspace === undefined || !Number.isFinite(intent.value)) return undefined;
      const block = statementsAt(workspace, intent.location.container)?.[intent.location.index];
      const condition = block?.inputs?.condition;
      if (
        (block?.type !== "control_if" && block?.type !== "control_repeat_until") ||
        condition === undefined ||
        Array.isArray(condition) ||
        !(STUDIO_COMPARISON_BLOCK_TYPES as readonly string[]).includes(condition.type)
      )
        return undefined;
      const operand = condition.inputs?.[intent.side];
      if (operand === undefined || Array.isArray(operand)) return undefined;
      if (
        operand.type === "lists_item"
          ? intent.field !== "index"
          : operand.type === "operator_random_integer"
            ? intent.field !== "min" && intent.field !== "max"
            : operand.type === "operator_math_function"
              ? intent.field !== "value"
              : true
      )
        return undefined;
      const current = operand.inputs?.[intent.field];
      if (current === undefined || Array.isArray(current) || current.type !== "literal_number")
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
                [intent.side]: {
                  ...operand,
                  inputs: {
                    ...operand.inputs,
                    [intent.field]: {
                      ...current,
                      fields: { ...current.fields, value: intent.value },
                    },
                  },
                },
              },
            },
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
