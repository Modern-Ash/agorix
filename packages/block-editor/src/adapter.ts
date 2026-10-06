import {
  SCHEMA_VERSION,
  validateProgram,
  type Expression,
  type ProjectProgram,
  type Script,
  type Statement,
} from "@agorix/program-model";

export type BlockType =
  | "event_on_start"
  | "event_green_flag"
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
  | "control_if"
  | "sensing_touching_goal"
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
  };
}

export interface BlockScript {
  readonly id: string;
  readonly programId?: string;
  readonly trigger: BlockNode;
  readonly statements: readonly BlockNode[];
}

export interface BlockWorkspaceSnapshot {
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

function booleanField(block: BlockNode, name: string, path: string): boolean {
  const value = block.fields?.[name];
  if (typeof value !== "boolean") {
    fail("MISSING_FIELD", `${path}.fields.${name}`, "expected a boolean", value);
  }
  return value;
}

function requiredInput(block: BlockNode, name: "condition", path: string): BlockNode {
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
    case "motion_set_x":
      return { type: "setX", x: numberField(block, "x", path) };
    case "motion_set_y":
      return { type: "setY", y: numberField(block, "y", path) };
    case "looks_show":
      return { type: "show" };
    case "looks_hide":
      return { type: "hide" };
    case "looks_set_size":
      return { type: "setSize", percent: numberField(block, "percent", path) };
    case "looks_say":
      return {
        type: "say",
        message: String(block.fields?.["message"] ?? ""),
        seconds: numberField(block, "seconds", path),
      };
    case "control_wait":
      return { type: "wait", seconds: numberField(block, "seconds", path) };
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
    case "setX":
      return { id, type: "motion_set_x", fields: { x: statement.x } };
    case "setY":
      return { id, type: "motion_set_y", fields: { y: statement.y } };
    case "show":
      return { id, type: "looks_show" };
    case "hide":
      return { id, type: "looks_hide" };
    case "setSize":
      return { id, type: "looks_set_size", fields: { percent: statement.percent } };
    case "say":
      return {
        id,
        type: "looks_say",
        fields: { message: statement.message, seconds: statement.seconds },
      };
    case "wait":
      return { id, type: "control_wait", fields: { seconds: statement.seconds } };
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
  if (trigger.type !== "event_on_start" && trigger.type !== "event_green_flag") {
    fail(
      "UNSUPPORTED_TRIGGER",
      `scripts[${index}].trigger.type`,
      "expected event_green_flag or event_on_start",
      trigger.type,
    );
  }
  return {
    id: script.programId ?? script.id,
    trigger: trigger.type === "event_green_flag" ? { type: "greenFlag" } : { type: "onStart" },
    statements: statementsFromBlocks(
      ensureBlockArray(script.statements, `scripts[${index}].statements`),
      `${scriptId}/statements`,
      `scripts[${index}].statements`,
      mapping,
    ),
  };
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
    scripts: workspace.scripts.map((script, index) => scriptFromBlocks(script, index, mapping)),
  });
  return { program, mapping };
}

export function programToWorkspace(program: ProjectProgram): ProgramToWorkspaceResult {
  const validated = validateProgram(program);
  const mapping: BlockMappingEntry[] = [];
  const workspace: BlockWorkspaceSnapshot = {
    scripts: validated.scripts.map((script, index) => {
      const scriptId = `scripts[${index}]`;
      const blockId = blockIdFor(scriptId);
      const triggerId = blockIdFor(`${scriptId}/trigger`);
      mapBlock(mapping, blockId, scriptId, "script");
      mapBlock(mapping, triggerId, `${scriptId}/trigger`, "trigger");
      return {
        id: blockId,
        programId: script.id,
        trigger: {
          id: triggerId,
          type: script.trigger.type === "greenFlag" ? "event_green_flag" : "event_on_start",
        },
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
