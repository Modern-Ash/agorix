import { SCHEMA_VERSION } from "./schema.js";
import type {
  Expression,
  ProjectProgram,
  Script,
  Statement,
  Trigger,
} from "./schema.js";

/**
 * Thrown by validateProgram for any malformed/unknown input. Names the path
 * (e.g. "scripts[0].statements[1].type") so failures are diagnosable, not a
 * generic "invalid program" message (issue #12 R4).
 */
export class ProgramValidationError extends Error {
  readonly path: string;
  readonly value: unknown;

  constructor(path: string, message: string, value: unknown) {
    super(`${path}: ${message}`);
    this.name = "ProgramValidationError";
    this.path = path;
    this.value = value;
  }
}

function fail(path: string, message: string, value: unknown): never {
  throw new ProgramValidationError(path, message, value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateExpression(input: unknown, path: string): Expression {
  if (!isPlainObject(input)) {
    fail(path, "expected an object", input);
  }
  const type = input.type;
  switch (type) {
    case "touchingGoal":
      return { type: "touchingGoal" };
    case "booleanLiteral": {
      if (typeof input.value !== "boolean") {
        fail(`${path}.value`, "expected a boolean", input.value);
      }
      return { type: "booleanLiteral", value: input.value };
    }
    case "numericLiteral": {
      if (typeof input.value !== "number" || Number.isNaN(input.value)) {
        fail(`${path}.value`, "expected a finite number", input.value);
      }
      return { type: "numericLiteral", value: input.value };
    }
    default:
      return fail(`${path}.type`, `unknown expression type ${JSON.stringify(type)}`, type);
  }
}

function validateStatementArray(input: unknown, path: string): Statement[] {
  if (!Array.isArray(input)) {
    fail(path, "expected an array", input);
  }
  return input.map((item, index) => validateStatement(item, `${path}[${index}]`));
}

function validateStatement(input: unknown, path: string): Statement {
  if (!isPlainObject(input)) {
    fail(path, "expected an object", input);
  }
  const type = input.type;
  switch (type) {
    case "move": {
      if (typeof input.steps !== "number") {
        fail(`${path}.steps`, "expected a number", input.steps);
      }
      return { type: "move", steps: input.steps };
    }
    case "turn": {
      if (typeof input.degrees !== "number") {
        fail(`${path}.degrees`, "expected a number", input.degrees);
      }
      return { type: "turn", degrees: input.degrees };
    }
    case "repeat": {
      if (typeof input.count !== "number") {
        fail(`${path}.count`, "expected a number", input.count);
      }
      return {
        type: "repeat",
        count: input.count,
        body: validateStatementArray(input.body, `${path}.body`),
      };
    }
    case "if": {
      return {
        type: "if",
        condition: validateExpression(input.condition, `${path}.condition`),
        then: validateStatementArray(input.then, `${path}.then`),
      };
    }
    default:
      return fail(`${path}.type`, `unknown statement type ${JSON.stringify(type)}`, type);
  }
}

function validateTrigger(input: unknown, path: string): Trigger {
  if (!isPlainObject(input)) {
    fail(path, "expected an object", input);
  }
  const type = input.type;
  switch (type) {
    case "onStart":
      return { type: "onStart" };
    default:
      return fail(`${path}.type`, `unknown trigger type ${JSON.stringify(type)}`, type);
  }
}

function validateScript(input: unknown, path: string): Script {
  if (!isPlainObject(input)) {
    fail(path, "expected an object", input);
  }
  if (typeof input.id !== "string" || input.id.length === 0) {
    fail(`${path}.id`, "expected a non-empty string", input.id);
  }
  return {
    id: input.id,
    trigger: validateTrigger(input.trigger, `${path}.trigger`),
    statements: validateStatementArray(input.statements, `${path}.statements`),
  };
}

/**
 * Validates untrusted input (e.g. loaded from persistence) against the
 * agorix/program/v1 schema. Throws ProgramValidationError on any mismatch,
 * including an unrecognized schema version or an unknown discriminator value
 * in any union position (issue #12 R4) — never silently passes unknown
 * operations through.
 */
export function validateProgram(input: unknown): ProjectProgram {
  if (!isPlainObject(input)) {
    fail("$", "expected an object", input);
  }
  if (input.schema !== SCHEMA_VERSION) {
    fail("$.schema", `expected ${JSON.stringify(SCHEMA_VERSION)}`, input.schema);
  }
  if (!Array.isArray(input.scripts)) {
    fail("$.scripts", "expected an array", input.scripts);
  }
  const scripts = input.scripts.map((item, index) => validateScript(item, `$.scripts[${index}]`));
  return { schema: SCHEMA_VERSION, scripts };
}
