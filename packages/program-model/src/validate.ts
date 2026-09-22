import { SCHEMA_VERSION } from "./schema.js";
import type {
  Expression,
  ProjectProgram,
  Script,
  Statement,
  Trigger,
} from "./schema.js";
import {
  MAX_NESTING_DEPTH,
  MAX_PROGRAM_NODES,
  MOVE_STEPS_MAX,
  MOVE_STEPS_MIN,
  NUMERIC_LITERAL_MAX,
  NUMERIC_LITERAL_MIN,
  REPEAT_COUNT_MAX,
  REPEAT_COUNT_MIN,
  TURN_DEGREES_MAX,
  TURN_DEGREES_MIN,
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
  | "NESTING_TOO_DEEP";

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

function fail(code: ProgramValidationErrorCode, path: string, message: string, value: unknown): never {
  throw new ProgramValidationError(code, path, message, value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function checkBounds(
  value: number,
  min: number,
  max: number,
  path: string,
): void {
  if (!Number.isFinite(value) || value < min || value > max) {
    fail("NUMERIC_OUT_OF_BOUNDS", path, `expected a finite number in [${min}, ${max}]`, value);
  }
}

/** Mutable traversal state threaded through validation (issue #13 size/depth limits). */
interface ValidationState {
  nodeCount: number;
  seenIds: Map<string, string>; // id -> first path where it was seen
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
    fail("INVALID_SCHEMA_VERSION", "$.schema", `expected ${JSON.stringify(SCHEMA_VERSION)}`, input.schema);
  }
  if (!Array.isArray(input.scripts)) {
    fail("INVALID_FIELD_TYPE", "$.scripts", "expected an array", input.scripts);
  }
  const state: ValidationState = { nodeCount: 0, seenIds: new Map() };
  const scripts = input.scripts.map((item, index) =>
    validateScript(item, `$.scripts[${index}]`, state),
  );
  return { schema: SCHEMA_VERSION, scripts };
}
