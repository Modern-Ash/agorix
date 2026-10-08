import { SCHEMA_VERSION } from "./schema.js";
import type {
  Expression,
  ProgramVariable,
  ProjectProgram,
  Script,
  Statement,
  Trigger,
} from "./schema.js";
import {
  MAX_NESTING_DEPTH,
  EVENT_KEY_MAX_LENGTH,
  EVENT_MESSAGE_MAX_LENGTH,
  MAX_PROGRAM_NODES,
  LOOKS_TEXT_MAX_LENGTH,
  MOVE_STEPS_MAX,
  MOVE_STEPS_MIN,
  NUMERIC_LITERAL_MAX,
  NUMERIC_LITERAL_MIN,
  REPEAT_COUNT_MAX,
  REPEAT_COUNT_MIN,
  SPRITE_SIZE_MAX,
  SPRITE_SIZE_MIN,
  TURN_DEGREES_MAX,
  TURN_DEGREES_MIN,
  VARIABLE_NAME_MAX_LENGTH,
} from "./limits.js";

/**
 * Stable, machine-readable error codes (issue #13 R7). Callers can branch on
 * `code` without parsing the message; the message is for developers only.
 */
export type ProgramValidationErrorCode =
  | "INVALID_ROOT"
  | "INVALID_SCHEMA_VERSION"
  | "DUPLICATE_ID"
  | "UNKNOWN_STATEMENT_TYPE"
  | "UNKNOWN_EXPRESSION_TYPE"
  | "UNKNOWN_TRIGGER_TYPE"
  | "MISSING_FIELD"
  | "INVALID_FIELD_TYPE"
  | "NUMERIC_OUT_OF_BOUNDS"
  | "PROGRAM_TOO_LARGE"
  | "NESTING_TOO_DEEP"
  | "INVALID_CREATIVE_STATE"
  | "INVALID_REFERENCE";

/**
 * Thrown by validateProgram for any malformed/unknown/unsafe input. Names the
 * path (e.g. "scripts[0].statements[1].type") and carries a stable `code` so
 * failures are both diagnosable and machine-branchable (issue #12 R4, issue
 * #13 R7). Fails fast on the first violation in deterministic top-down,
 * left-to-right traversal order (issue #13 R6): validateProgram never returns
 * a partially-checked ProjectProgram.
 */
export class ProgramValidationError extends Error {
  readonly code: ProgramValidationErrorCode;
  readonly path: string;
  readonly value: unknown;

  constructor(code: ProgramValidationErrorCode, path: string, message: string, value: unknown) {
    super(`${code} ${path}: ${message}`);
    this.name = "ProgramValidationError";
    this.code = code;
    this.path = path;
    this.value = value;
  }
}

function fail(
  code: ProgramValidationErrorCode,
  path: string,
  message: string,
  value: unknown,
): never {
  throw new ProgramValidationError(code, path, message, value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function checkBounds(value: number, min: number, max: number, path: string): void {
  if (!Number.isFinite(value) || value < min || value > max) {
    fail("NUMERIC_OUT_OF_BOUNDS", path, `expected a finite number in [${min}, ${max}]`, value);
  }
}

function checkText(value: unknown, path: string): string {
  if (typeof value !== "string" || value.length < 1 || value.length > LOOKS_TEXT_MAX_LENGTH) {
    fail(
      "INVALID_FIELD_TYPE",
      path,
      `expected a non-empty string of at most ${LOOKS_TEXT_MAX_LENGTH} characters`,
      value,
    );
  }
  return value;
}

function checkLimitedText(value: unknown, path: string, maxLength: number, label: string): string {
  if (typeof value !== "string" || value.length < 1 || value.length > maxLength) {
    fail(
      "INVALID_FIELD_TYPE",
      path,
      `expected a non-empty ${label} string of at most ${maxLength} characters`,
      value,
    );
  }
  return value;
}

/** Mutable traversal state threaded through validation (issue #13 size/depth limits). */
interface ValidationState {
  nodeCount: number;
  seenIds: Map<string, string>; // id -> first path where it was seen
  variableIds: Set<string>;
}

function countNode(state: ValidationState, path: string): void {
  state.nodeCount += 1;
  if (state.nodeCount > MAX_PROGRAM_NODES) {
    fail(
      "PROGRAM_TOO_LARGE",
      path,
      `program exceeds the maximum of ${MAX_PROGRAM_NODES} statement/expression nodes`,
      state.nodeCount,
    );
  }
}

function checkDepth(depth: number, path: string): void {
  if (depth > MAX_NESTING_DEPTH) {
    fail(
      "NESTING_TOO_DEEP",
      path,
      `nesting exceeds the maximum depth of ${MAX_NESTING_DEPTH}`,
      depth,
    );
  }
}

function assertKnownVariableId(value: unknown, path: string, state: ValidationState): string {
  if (typeof value !== "string" || value.length === 0) {
    fail("MISSING_FIELD", path, "expected a non-empty variable id", value);
  }
  if (!state.variableIds.has(value)) {
    fail("INVALID_REFERENCE", path, `unknown variable id ${JSON.stringify(value)}`, value);
  }
  return value;
}

function validateBinaryExpression(
  input: Record<string, unknown>,
  path: string,
  state: ValidationState,
  type:
    | "add"
    | "subtract"
    | "multiply"
    | "divide"
    | "lessThan"
    | "greaterThan"
    | "equals"
    | "and"
    | "or",
): Expression {
  return {
    type,
    left: validateExpression(input.left, `${path}.left`, state),
    right: validateExpression(input.right, `${path}.right`, state),
  };
}

function validateUnaryExpression(
  input: Record<string, unknown>,
  path: string,
  state: ValidationState,
): Expression {
  return {
    type: "not",
    value: validateExpression(input.value, `${path}.value`, state),
  };
}

function validateRandomExpression(
  input: Record<string, unknown>,
  path: string,
  state: ValidationState,
): Expression {
  return {
    type: "random",
    min: validateExpression(input.min, `${path}.min`, state),
    max: validateExpression(input.max, `${path}.max`, state),
  };
}

function validateExpression(input: unknown, path: string, state: ValidationState): Expression {
  countNode(state, path);
  if (!isPlainObject(input)) {
    fail("INVALID_FIELD_TYPE", path, "expected an object", input);
  }
  const type = input.type;
  switch (type) {
    case "touchingGoal":
      return { type: "touchingGoal" };
    case "booleanLiteral": {
      if (typeof input.value !== "boolean") {
        fail("INVALID_FIELD_TYPE", `${path}.value`, "expected a boolean", input.value);
      }
      return { type: "booleanLiteral", value: input.value };
    }
    case "numericLiteral": {
      if (typeof input.value !== "number") {
        fail("INVALID_FIELD_TYPE", `${path}.value`, "expected a number", input.value);
      }
      checkBounds(input.value, NUMERIC_LITERAL_MIN, NUMERIC_LITERAL_MAX, `${path}.value`);
      return { type: "numericLiteral", value: input.value };
    }
    case "variable":
      return {
        type: "variable",
        variableId: assertKnownVariableId(input.variableId, `${path}.variableId`, state),
      };
    case "add":
    case "subtract":
    case "multiply":
    case "divide":
    case "lessThan":
    case "greaterThan":
    case "equals":
    case "and":
    case "or":
      return validateBinaryExpression(input, path, state, type);
    case "not":
      return validateUnaryExpression(input, path, state);
    case "random":
      return validateRandomExpression(input, path, state);
    default:
      return fail(
        "UNKNOWN_EXPRESSION_TYPE",
        `${path}.type`,
        `unknown expression type ${JSON.stringify(type)}`,
        type,
      );
  }
}

function validateStatementArray(
  input: unknown,
  path: string,
  state: ValidationState,
  depth: number,
): Statement[] {
  if (!Array.isArray(input)) {
    fail("INVALID_FIELD_TYPE", path, "expected an array", input);
  }
  return input.map((item, index) => validateStatement(item, `${path}[${index}]`, state, depth));
}

function validateStatement(
  input: unknown,
  path: string,
  state: ValidationState,
  depth: number,
): Statement {
  countNode(state, path);
  if (!isPlainObject(input)) {
    fail("INVALID_FIELD_TYPE", path, "expected an object", input);
  }
  const type = input.type;
  switch (type) {
    case "move": {
      if (typeof input.steps !== "number") {
        fail("MISSING_FIELD", `${path}.steps`, "expected a number", input.steps);
      }
      checkBounds(input.steps, MOVE_STEPS_MIN, MOVE_STEPS_MAX, `${path}.steps`);
      return { type: "move", steps: input.steps };
    }
    case "turn": {
      if (typeof input.degrees !== "number") {
        fail("MISSING_FIELD", `${path}.degrees`, "expected a number", input.degrees);
      }
      checkBounds(input.degrees, TURN_DEGREES_MIN, TURN_DEGREES_MAX, `${path}.degrees`);
      return { type: "turn", degrees: input.degrees };
    }
    case "say":
      return { type: "say", text: checkText(input.text, `${path}.text`) };
    case "think":
      return { type: "think", text: checkText(input.text, `${path}.text`) };
    case "show":
      return { type: "show" };
    case "hide":
      return { type: "hide" };
    case "setSize": {
      if (typeof input.size !== "number") {
        fail("MISSING_FIELD", `${path}.size`, "expected a number", input.size);
      }
      checkBounds(input.size, SPRITE_SIZE_MIN, SPRITE_SIZE_MAX, `${path}.size`);
      return { type: "setSize", size: input.size };
    }
    case "switchCostume":
      return { type: "switchCostume", costumeId: checkText(input.costumeId, `${path}.costumeId`) };
    case "switchBackdrop":
      return {
        type: "switchBackdrop",
        backdropId: checkText(input.backdropId, `${path}.backdropId`),
      };
    case "playSound":
      return { type: "playSound", soundId: checkText(input.soundId, `${path}.soundId`) };
    case "stopSounds":
      return { type: "stopSounds" };
    case "broadcast":
      return {
        type: "broadcast",
        message: checkLimitedText(
          input.message,
          `${path}.message`,
          EVENT_MESSAGE_MAX_LENGTH,
          "event message",
        ),
      };
    case "setVariable":
      return {
        type: "setVariable",
        variableId: assertKnownVariableId(input.variableId, `${path}.variableId`, state),
        value: validateExpression(input.value, `${path}.value`, state),
      };
    case "changeVariable":
      return {
        type: "changeVariable",
        variableId: assertKnownVariableId(input.variableId, `${path}.variableId`, state),
        delta: validateExpression(input.delta, `${path}.delta`, state),
      };
    case "showVariable":
      return {
        type: "showVariable",
        variableId: assertKnownVariableId(input.variableId, `${path}.variableId`, state),
      };
    case "hideVariable":
      return {
        type: "hideVariable",
        variableId: assertKnownVariableId(input.variableId, `${path}.variableId`, state),
      };
    case "repeat": {
      if (typeof input.count !== "number") {
        fail("MISSING_FIELD", `${path}.count`, "expected a number", input.count);
      }
      checkBounds(input.count, REPEAT_COUNT_MIN, REPEAT_COUNT_MAX, `${path}.count`);
      const nextDepth = depth + 1;
      checkDepth(nextDepth, `${path}.body`);
      return {
        type: "repeat",
        count: input.count,
        body: validateStatementArray(input.body, `${path}.body`, state, nextDepth),
      };
    }
    case "if": {
      const nextDepth = depth + 1;
      checkDepth(nextDepth, `${path}.then`);
      return {
        type: "if",
        condition: validateExpression(input.condition, `${path}.condition`, state),
        then: validateStatementArray(input.then, `${path}.then`, state, nextDepth),
      };
    }
    default:
      return fail(
        "UNKNOWN_STATEMENT_TYPE",
        `${path}.type`,
        `unknown statement type ${JSON.stringify(type)}`,
        type,
      );
  }
}

function validateTrigger(input: unknown, path: string): Trigger {
  if (!isPlainObject(input)) {
    fail("INVALID_FIELD_TYPE", path, "expected an object", input);
  }
  const type = input.type;
  switch (type) {
    case "onStart":
      return { type: "onStart" };
    case "onKeyPressed":
      return {
        type: "onKeyPressed",
        key: checkLimitedText(input.key, `${path}.key`, EVENT_KEY_MAX_LENGTH, "event key"),
      };
    case "onActorClicked":
      return { type: "onActorClicked" };
    case "onMessage":
      return {
        type: "onMessage",
        message: checkLimitedText(
          input.message,
          `${path}.message`,
          EVENT_MESSAGE_MAX_LENGTH,
          "event message",
        ),
      };
    default:
      return fail(
        "UNKNOWN_TRIGGER_TYPE",
        `${path}.type`,
        `unknown trigger type ${JSON.stringify(type)}`,
        type,
      );
  }
}

function recordId(state: ValidationState, id: string, path: string): void {
  const firstSeenAt = state.seenIds.get(id);
  if (firstSeenAt !== undefined) {
    fail("DUPLICATE_ID", path, `id ${JSON.stringify(id)} already used at ${firstSeenAt}`, id);
  }
  state.seenIds.set(id, path);
}

function validateVariable(input: unknown, path: string, state: ValidationState): ProgramVariable {
  if (!isPlainObject(input)) {
    fail("INVALID_FIELD_TYPE", path, "expected an object", input);
  }
  if (typeof input.id !== "string" || input.id.length === 0) {
    fail("MISSING_FIELD", `${path}.id`, "expected a non-empty string", input.id);
  }
  recordId(state, input.id, `${path}.id`);
  state.variableIds.add(input.id);
  const name = checkLimitedText(
    input.name,
    `${path}.name`,
    VARIABLE_NAME_MAX_LENGTH,
    "variable name",
  );
  if (typeof input.initialValue !== "number") {
    fail("MISSING_FIELD", `${path}.initialValue`, "expected a number", input.initialValue);
  }
  checkBounds(input.initialValue, NUMERIC_LITERAL_MIN, NUMERIC_LITERAL_MAX, `${path}.initialValue`);
  if (typeof input.visible !== "boolean") {
    fail("MISSING_FIELD", `${path}.visible`, "expected a boolean", input.visible);
  }
  return { id: input.id, name, initialValue: input.initialValue, visible: input.visible };
}

function validateScript(input: unknown, path: string, state: ValidationState): Script {
  countNode(state, path);
  if (!isPlainObject(input)) {
    fail("INVALID_FIELD_TYPE", path, "expected an object", input);
  }
  if (typeof input.id !== "string" || input.id.length === 0) {
    fail("MISSING_FIELD", `${path}.id`, "expected a non-empty string", input.id);
  }
  recordId(state, input.id, `${path}.id`);
  return {
    id: input.id,
    trigger: validateTrigger(input.trigger, `${path}.trigger`),
    statements: validateStatementArray(input.statements, `${path}.statements`, state, 1),
  };
}

/**
 * Validates untrusted input (e.g. loaded from persistence) against the
 * agorix/program/v1 schema, including id uniqueness, numeric bounds, and POC
 * size/nesting limits (issue #13). Throws ProgramValidationError — with a
 * stable `code` — on the first violation encountered; never returns a
 * partially-validated program.
 */
export function validateProgram(input: unknown): ProjectProgram {
  if (!isPlainObject(input)) {
    fail("INVALID_ROOT", "$", "expected an object", input);
  }
  if (input.schema !== SCHEMA_VERSION) {
    fail(
      "INVALID_SCHEMA_VERSION",
      "$.schema",
      `expected ${JSON.stringify(SCHEMA_VERSION)}`,
      input.schema,
    );
  }
  if (!Array.isArray(input.scripts)) {
    fail("INVALID_FIELD_TYPE", "$.scripts", "expected an array", input.scripts);
  }
  const state: ValidationState = { nodeCount: 0, seenIds: new Map(), variableIds: new Set() };
  const variables =
    input.variables === undefined
      ? undefined
      : Array.isArray(input.variables)
        ? input.variables.map((item, index) =>
            validateVariable(item, `$.variables[${index}]`, state),
          )
        : fail("INVALID_FIELD_TYPE", "$.variables", "expected an array", input.variables);
  const scripts = input.scripts.map((item, index) =>
    validateScript(item, `$.scripts[${index}]`, state),
  );
  return variables === undefined
    ? { schema: SCHEMA_VERSION, scripts }
    : { schema: SCHEMA_VERSION, variables, scripts };
}
