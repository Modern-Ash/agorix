import {
  SCHEMA_VERSION,
  validateProgram,
  type Expression,
  type ProgramVariable,
  type ProjectProgram,
  type Script,
  type Statement,
  type Trigger,
} from "@agorix/program-model";

export type BlockType =
  | "event_on_start"
  | "event_on_key_pressed"
  | "event_on_actor_clicked"
  | "event_on_message"
  | "event_broadcast"
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
  | "control_repeat"
  | "control_if"
  | "sensing_touching_goal"
  | "operator_add"
  | "operator_subtract"
  | "operator_multiply"
  | "operator_divide"
  | "operator_less_than"
  | "operator_greater_than"
  | "operator_equals"
  | "operator_and"
  | "operator_or"
  | "operator_not"
  | "operator_random"
  | "variables_value"
  | "variables_set"
  | "variables_change"
  | "variables_show"
  | "variables_hide"
  | "literal_boolean"
  | "literal_number";

export interface BlockNode {
  readonly id: string;
  readonly type: BlockType;
  readonly fields?: Readonly<Record<string, unknown>>;
  readonly inputs?: {
    readonly body?: readonly BlockNode[];
    readonly then?: readonly BlockNode[];
    readonly condition?: BlockNode;
    readonly left?: BlockNode;
    readonly right?: BlockNode;
    readonly value?: BlockNode;
    readonly min?: BlockNode;
    readonly max?: BlockNode;
    readonly delta?: BlockNode;
  };
}

export interface BlockScript {
  readonly id: string;
  readonly programId?: string;
  readonly trigger: BlockNode;
  readonly statements: readonly BlockNode[];
}

export interface BlockWorkspaceSnapshot {
  readonly variables?: readonly ProgramVariable[];
  readonly scripts: readonly BlockScript[];
}

export type BlockMappingKind = "script" | "trigger" | "statement" | "expression";

export interface BlockMappingEntry {
  readonly blockId: string;
  readonly nodeId: string;
  readonly kind: BlockMappingKind;
}

export interface WorkspaceToProgramResult {
  readonly program: ProjectProgram;
  readonly mapping: readonly BlockMappingEntry[];
}

export interface ProgramToWorkspaceResult {
  readonly workspace: BlockWorkspaceSnapshot;
  readonly mapping: readonly BlockMappingEntry[];
}

export type BlockEditorAdapterErrorCode =
  | "INVALID_WORKSPACE"
  | "UNKNOWN_BLOCK_TYPE"
  | "UNSUPPORTED_TRIGGER"
  | "MISSING_FIELD"
  | "INVALID_FIELD_TYPE";

/** Why a visual placement was refused; lets UIs explain it without parsing messages. */
export type PlacementReason =
  "NOT_A_CONTAINER" | "BAD_INDEX" | "BLOCK_NOT_FOUND" | "NOT_A_STATEMENT";

export class BlockEditorAdapterError extends Error {
  readonly code: BlockEditorAdapterErrorCode;
  readonly path: string;
  readonly value: unknown;
  readonly reason?: PlacementReason;

  constructor(
    code: BlockEditorAdapterErrorCode,
    path: string,
    message: string,
    value: unknown,
    reason?: PlacementReason,
  ) {
    super(`${code} ${path}: ${message}`);
    this.name = "BlockEditorAdapterError";
    this.code = code;
    this.path = path;
    this.value = value;
    if (reason !== undefined) this.reason = reason;
  }
}

function fail(
  code: BlockEditorAdapterErrorCode,
  path: string,
  message: string,
  value: unknown,
): never {
  throw new BlockEditorAdapterError(code, path, message, value);
}

function ensureBlock(value: unknown, path: string): BlockNode {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail("INVALID_WORKSPACE", path, "expected a block object", value);
  }
  const block = value as Partial<BlockNode>;
  if (typeof block.id !== "string" || block.id.length === 0) {
    fail("MISSING_FIELD", `${path}.id`, "expected a non-empty string", block.id);
  }
  if (typeof block.type !== "string" || block.type.length === 0) {
    fail("MISSING_FIELD", `${path}.type`, "expected a non-empty string", block.type);
  }
  return block as BlockNode;
}

function ensureBlockArray(value: unknown, path: string): readonly BlockNode[] {
  if (!Array.isArray(value)) {
    fail("INVALID_FIELD_TYPE", path, "expected an array of blocks", value);
  }
  return value.map((item, index) => ensureBlock(item, `${path}[${index}]`));
}

function numberField(block: BlockNode, name: string, path: string): number {
  const value = block.fields?.[name];
  if (typeof value !== "number") {
    fail("MISSING_FIELD", `${path}.fields.${name}`, "expected a number", value);
  }
  return value;
}

function stringField(block: BlockNode, name: string, path: string): string {
  const value = block.fields?.[name];
  if (typeof value !== "string") {
    fail("MISSING_FIELD", `${path}.fields.${name}`, "expected a string", value);
  }
  return value;
}

function booleanField(block: BlockNode, name: string, path: string): boolean {
  const value = block.fields?.[name];
  if (typeof value !== "boolean") {
    fail("MISSING_FIELD", `${path}.fields.${name}`, "expected a boolean", value);
  }
  return value;
}

function requiredInput(
  block: BlockNode,
  name: "condition" | "left" | "right" | "value" | "min" | "max" | "delta",
  path: string,
): BlockNode {
  const input = block.inputs?.[name];
  if (input === undefined) {
    fail("MISSING_FIELD", `${path}.inputs.${name}`, "expected an input block", input);
  }
  return ensureBlock(input, `${path}.inputs.${name}`);
}

function statementInput(
  block: BlockNode,
  name: "body" | "then",
  path: string,
): readonly BlockNode[] {
  const input = block.inputs?.[name] ?? [];
  return ensureBlockArray(input, `${path}.inputs.${name}`);
}

function blockIdFor(nodeId: string): string {
  return `block:${nodeId.replace(/[^A-Za-z0-9_-]+/g, "_")}`;
}

function mapBlock(
  mapping: BlockMappingEntry[],
  blockId: string,
  nodeId: string,
  kind: BlockMappingKind,
): void {
  mapping.push({ blockId, nodeId, kind });
}

function expressionFromBlock(
  block: BlockNode,
  nodeId: string,
  path: string,
  mapping: BlockMappingEntry[],
): Expression {
  mapBlock(mapping, block.id, nodeId, "expression");
  switch (block.type) {
    case "sensing_touching_goal":
      return { type: "touchingGoal" };
    case "literal_boolean":
      return { type: "booleanLiteral", value: booleanField(block, "value", path) };
    case "literal_number":
      return { type: "numericLiteral", value: numberField(block, "value", path) };
    case "variables_value":
      return { type: "variable", variableId: stringField(block, "variableId", path) };
    case "operator_add":
    case "operator_subtract":
    case "operator_multiply":
    case "operator_divide":
    case "operator_less_than":
    case "operator_greater_than":
    case "operator_equals":
    case "operator_and":
    case "operator_or": {
      const typeByBlock = {
        operator_add: "add",
        operator_subtract: "subtract",
        operator_multiply: "multiply",
        operator_divide: "divide",
        operator_less_than: "lessThan",
        operator_greater_than: "greaterThan",
        operator_equals: "equals",
        operator_and: "and",
        operator_or: "or",
      } as const;
      return {
        type: typeByBlock[block.type],
        left: expressionFromBlock(
          requiredInput(block, "left", path),
          `${nodeId}/left`,
          `${path}.inputs.left`,
          mapping,
        ),
        right: expressionFromBlock(
          requiredInput(block, "right", path),
          `${nodeId}/right`,
          `${path}.inputs.right`,
          mapping,
        ),
      };
    }
    case "operator_not":
      return {
        type: "not",
        value: expressionFromBlock(
          requiredInput(block, "value", path),
          `${nodeId}/value`,
          `${path}.inputs.value`,
          mapping,
        ),
      };
    case "operator_random":
      return {
        type: "random",
        min: expressionFromBlock(
          requiredInput(block, "min", path),
          `${nodeId}/min`,
          `${path}.inputs.min`,
          mapping,
        ),
        max: expressionFromBlock(
          requiredInput(block, "max", path),
          `${nodeId}/max`,
          `${path}.inputs.max`,
          mapping,
        ),
      };
    default:
      return fail(
        "UNKNOWN_BLOCK_TYPE",
        `${path}.type`,
        `unknown expression block type ${JSON.stringify(block.type)}`,
        block.type,
      );
  }
}

function statementsFromBlocks(
  blocks: readonly BlockNode[],
  nodePath: string,
  blockPath: string,
  mapping: BlockMappingEntry[],
): Statement[] {
  return blocks.map((block, index) =>
    statementFromBlock(block, `${nodePath}[${index}]`, `${blockPath}[${index}]`, mapping),
  );
}

function statementFromBlock(
  block: BlockNode,
  nodeId: string,
  path: string,
  mapping: BlockMappingEntry[],
): Statement {
  mapBlock(mapping, block.id, nodeId, "statement");
  switch (block.type) {
    case "motion_move":
      return { type: "move", steps: numberField(block, "steps", path) };
    case "motion_turn":
      return { type: "turn", degrees: numberField(block, "degrees", path) };
    case "looks_say":
      return { type: "say", text: stringField(block, "text", path) };
    case "looks_think":
      return { type: "think", text: stringField(block, "text", path) };
    case "looks_show":
      return { type: "show" };
    case "looks_hide":
      return { type: "hide" };
    case "looks_set_size":
      return { type: "setSize", size: numberField(block, "size", path) };
    case "looks_switch_costume":
      return { type: "switchCostume", costumeId: stringField(block, "costumeId", path) };
    case "looks_switch_backdrop":
      return { type: "switchBackdrop", backdropId: stringField(block, "backdropId", path) };
    case "sound_play":
      return { type: "playSound", soundId: stringField(block, "soundId", path) };
    case "sound_stop":
      return { type: "stopSounds" };
    case "event_broadcast":
      return { type: "broadcast", message: stringField(block, "message", path) };
    case "variables_set":
      return {
        type: "setVariable",
        variableId: stringField(block, "variableId", path),
        value: expressionFromBlock(
          requiredInput(block, "value", path),
          `${nodeId}/value`,
          `${path}.inputs.value`,
          mapping,
        ),
      };
    case "variables_change":
      return {
        type: "changeVariable",
        variableId: stringField(block, "variableId", path),
        delta: expressionFromBlock(
          requiredInput(block, "delta", path),
          `${nodeId}/delta`,
          `${path}.inputs.delta`,
          mapping,
        ),
      };
    case "variables_show":
      return { type: "showVariable", variableId: stringField(block, "variableId", path) };
    case "variables_hide":
      return { type: "hideVariable", variableId: stringField(block, "variableId", path) };
    case "control_repeat":
      return {
        type: "repeat",
        count: numberField(block, "count", path),
        body: statementsFromBlocks(
          statementInput(block, "body", path),
          `${nodeId}/body`,
          `${path}.inputs.body`,
          mapping,
        ),
      };
    case "control_if":
      return {
        type: "if",
        condition: expressionFromBlock(
          requiredInput(block, "condition", path),
          `${nodeId}/condition`,
          `${path}.inputs.condition`,
          mapping,
        ),
        then: statementsFromBlocks(
          statementInput(block, "then", path),
          `${nodeId}/then`,
          `${path}.inputs.then`,
          mapping,
        ),
      };
    default:
      return fail(
        "UNKNOWN_BLOCK_TYPE",
        `${path}.type`,
        `unknown statement block type ${JSON.stringify(block.type)}`,
        block.type,
      );
  }
}

function expressionToBlock(
  expression: Expression,
  nodeId: string,
  mapping: BlockMappingEntry[],
): BlockNode {
  const id = blockIdFor(nodeId);
  mapBlock(mapping, id, nodeId, "expression");
  switch (expression.type) {
    case "touchingGoal":
      return { id, type: "sensing_touching_goal" };
    case "booleanLiteral":
      return { id, type: "literal_boolean", fields: { value: expression.value } };
    case "numericLiteral":
      return { id, type: "literal_number", fields: { value: expression.value } };
    case "variable":
      return { id, type: "variables_value", fields: { variableId: expression.variableId } };
    case "add":
    case "subtract":
    case "multiply":
    case "divide":
    case "lessThan":
    case "greaterThan":
    case "equals":
    case "and":
    case "or": {
      const blockByType = {
        add: "operator_add",
        subtract: "operator_subtract",
        multiply: "operator_multiply",
        divide: "operator_divide",
        lessThan: "operator_less_than",
        greaterThan: "operator_greater_than",
        equals: "operator_equals",
        and: "operator_and",
        or: "operator_or",
      } as const;
      return {
        id,
        type: blockByType[expression.type],
        inputs: {
          left: expressionToBlock(expression.left, `${nodeId}/left`, mapping),
          right: expressionToBlock(expression.right, `${nodeId}/right`, mapping),
        },
      };
    }
    case "not":
      return {
        id,
        type: "operator_not",
        inputs: {
          value: expressionToBlock(expression.value, `${nodeId}/value`, mapping),
        },
      };
    case "random":
      return {
        id,
        type: "operator_random",
        inputs: {
          min: expressionToBlock(expression.min, `${nodeId}/min`, mapping),
          max: expressionToBlock(expression.max, `${nodeId}/max`, mapping),
        },
      };
    default: {
      const unknown = expression as { type?: unknown };
      return fail(
        "UNKNOWN_BLOCK_TYPE",
        `${nodeId}.type`,
        `unknown expression type ${JSON.stringify(unknown.type)}`,
        unknown.type,
      );
    }
  }
}

function statementsToBlocks(
  statements: readonly Statement[],
  nodePath: string,
  mapping: BlockMappingEntry[],
): BlockNode[] {
  return statements.map((statement, index) =>
    statementToBlock(statement, `${nodePath}[${index}]`, mapping),
  );
}

function statementToBlock(
  statement: Statement,
  nodeId: string,
  mapping: BlockMappingEntry[],
): BlockNode {
  const id = blockIdFor(nodeId);
  mapBlock(mapping, id, nodeId, "statement");
  switch (statement.type) {
    case "move":
      return { id, type: "motion_move", fields: { steps: statement.steps } };
    case "turn":
      return { id, type: "motion_turn", fields: { degrees: statement.degrees } };
    case "say":
      return { id, type: "looks_say", fields: { text: statement.text } };
    case "think":
      return { id, type: "looks_think", fields: { text: statement.text } };
    case "show":
      return { id, type: "looks_show" };
    case "hide":
      return { id, type: "looks_hide" };
    case "setSize":
      return { id, type: "looks_set_size", fields: { size: statement.size } };
    case "switchCostume":
      return { id, type: "looks_switch_costume", fields: { costumeId: statement.costumeId } };
    case "switchBackdrop":
      return { id, type: "looks_switch_backdrop", fields: { backdropId: statement.backdropId } };
    case "playSound":
      return { id, type: "sound_play", fields: { soundId: statement.soundId } };
    case "stopSounds":
      return { id, type: "sound_stop" };
    case "broadcast":
      return { id, type: "event_broadcast", fields: { message: statement.message } };
    case "setVariable":
      return {
        id,
        type: "variables_set",
        fields: { variableId: statement.variableId },
        inputs: { value: expressionToBlock(statement.value, `${nodeId}/value`, mapping) },
      };
    case "changeVariable":
      return {
        id,
        type: "variables_change",
        fields: { variableId: statement.variableId },
        inputs: { delta: expressionToBlock(statement.delta, `${nodeId}/delta`, mapping) },
      };
    case "showVariable":
      return { id, type: "variables_show", fields: { variableId: statement.variableId } };
    case "hideVariable":
      return { id, type: "variables_hide", fields: { variableId: statement.variableId } };
    case "repeat":
      return {
        id,
        type: "control_repeat",
        fields: { count: statement.count },
        inputs: { body: statementsToBlocks(statement.body, `${nodeId}/body`, mapping) },
      };
    case "if":
      return {
        id,
        type: "control_if",
        inputs: {
          condition: expressionToBlock(statement.condition, `${nodeId}/condition`, mapping),
          then: statementsToBlocks(statement.then, `${nodeId}/then`, mapping),
        },
      };
    default: {
      const unknown = statement as { type?: unknown };
      return fail(
        "UNKNOWN_BLOCK_TYPE",
        `${nodeId}.type`,
        `unknown statement type ${JSON.stringify(unknown.type)}`,
        unknown.type,
      );
    }
  }
}

function scriptFromBlocks(
  script: BlockScript,
  index: number,
  mapping: BlockMappingEntry[],
): Script {
  const scriptId = `scripts[${index}]`;
  mapBlock(mapping, script.id, scriptId, "script");
  const trigger = ensureBlock(script.trigger, `scripts[${index}].trigger`);
  mapBlock(mapping, trigger.id, `${scriptId}/trigger`, "trigger");
  return {
    id: script.programId ?? script.id,
    trigger: triggerFromBlock(trigger, `scripts[${index}].trigger`),
    statements: statementsFromBlocks(
      ensureBlockArray(script.statements, `scripts[${index}].statements`),
      `${scriptId}/statements`,
      `scripts[${index}].statements`,
      mapping,
    ),
  };
}

function triggerFromBlock(block: BlockNode, path: string): Trigger {
  switch (block.type) {
    case "event_on_start":
      return { type: "onStart" };
    case "event_on_key_pressed":
      return { type: "onKeyPressed", key: stringField(block, "key", path) };
    case "event_on_actor_clicked":
      return { type: "onActorClicked" };
    case "event_on_message":
      return { type: "onMessage", message: stringField(block, "message", path) };
    default:
      return fail(
        "UNSUPPORTED_TRIGGER",
        `${path}.type`,
        "expected an event trigger block",
        block.type,
      );
  }
}

function triggerToBlock(trigger: Trigger, id: string): BlockNode {
  switch (trigger.type) {
    case "onStart":
      return { id, type: "event_on_start" };
    case "onKeyPressed":
      return { id, type: "event_on_key_pressed", fields: { key: trigger.key } };
    case "onActorClicked":
      return { id, type: "event_on_actor_clicked" };
    case "onMessage":
      return { id, type: "event_on_message", fields: { message: trigger.message } };
  }
}

export function workspaceToProgram(workspace: BlockWorkspaceSnapshot): WorkspaceToProgramResult {
  if (typeof workspace !== "object" || workspace === null || Array.isArray(workspace)) {
    fail("INVALID_WORKSPACE", "$", "expected a workspace object", workspace);
  }
  if (!Array.isArray(workspace.scripts)) {
    fail("INVALID_FIELD_TYPE", "$.scripts", "expected an array", workspace.scripts);
  }
  const mapping: BlockMappingEntry[] = [];
  const program = validateProgram({
    schema: SCHEMA_VERSION,
    ...(workspace.variables === undefined ? {} : { variables: workspace.variables }),
    scripts: workspace.scripts.map((script, index) => scriptFromBlocks(script, index, mapping)),
  });
  return { program, mapping };
}

export function programToWorkspace(program: ProjectProgram): ProgramToWorkspaceResult {
  const validated = validateProgram(program);
  const mapping: BlockMappingEntry[] = [];
  const workspace: BlockWorkspaceSnapshot = {
    ...(validated.variables === undefined ? {} : { variables: validated.variables }),
    scripts: validated.scripts.map((script, index) => {
      const scriptId = `scripts[${index}]`;
      const blockId = blockIdFor(scriptId);
      const triggerId = blockIdFor(`${scriptId}/trigger`);
      mapBlock(mapping, blockId, scriptId, "script");
      mapBlock(mapping, triggerId, `${scriptId}/trigger`, "trigger");
      return {
        id: blockId,
        programId: script.id,
        trigger: triggerToBlock(script.trigger, triggerId),
        statements: statementsToBlocks(script.statements, `${scriptId}/statements`, mapping),
      };
    }),
  };
  return { workspace, mapping };
}

export function getCanonicalNodeIdForBlock(
  mapping: readonly BlockMappingEntry[],
  blockId: string,
): string | undefined {
  return mapping.find((entry) => entry.blockId === blockId)?.nodeId;
}
