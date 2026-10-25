import { SCHEMA_VERSION } from "./schema.js";
import type {
  Expression,
  MathFunction,
  ProgramList,
  ProgramVariable,
  ProjectProgram,
  Procedure,
  Script,
  GraphicEffect,
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
  LIST_MAX_ITEMS,
  NUMERIC_LITERAL_MAX,
  NUMERIC_LITERAL_MIN,
  PROCEDURES_MAX_PER_SCRIPT,
  PROCEDURE_BODY_MAX,
  PROCEDURE_NAME_MAX_LENGTH,
  REPEAT_COUNT_MAX,
  REPEAT_COUNT_MIN,
  SPRITE_SIZE_MAX,
  SPRITE_SIZE_MIN,
  TURN_DEGREES_MAX,
  TURN_DEGREES_MIN,
  VARIABLE_NAME_MAX_LENGTH,
  WAIT_SECONDS_MAX,
  WAIT_SECONDS_MIN,
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
  listIds: Set<string>;
  /** Custom blocks of the script being validated. */
  procedureIds: Set<string>;
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

function assertKnownListId(value: unknown, path: string, state: ValidationState): string {
  if (typeof value !== "string" || value.length === 0) {
    fail("MISSING_FIELD", path, "expected a non-empty list id", value);
  }
  if (!state.listIds.has(value)) {
    fail("INVALID_REFERENCE", path, `unknown list id ${JSON.stringify(value)}`, value);
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
    | "modulo"
    | "lessThan"
    | "greaterThan"
    | "lessOrEqual"
    | "greaterOrEqual"
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

const EFFECT_RANGES: Readonly<Record<GraphicEffect, readonly [number, number]>> = {
  color: [0, 200],
  ghost: [0, 100],
  brightness: [-100, 100],
};

function checkEffect(value: unknown, path: string): GraphicEffect {
  if (typeof value !== "string" || !Object.prototype.hasOwnProperty.call(EFFECT_RANGES, value)) {
    fail("INVALID_FIELD_TYPE", path, "expected color, ghost or brightness", value);
  }
  return value as GraphicEffect;
}

const MATH_FUNCTIONS: readonly string[] = ["abs", "round", "floor", "ceiling"];

function validateMathFunctionExpression(
  input: Record<string, unknown>,
  path: string,
  state: ValidationState,
): Expression {
  if (typeof input.function !== "string" || !MATH_FUNCTIONS.includes(input.function)) {
    fail(
      "INVALID_FIELD_TYPE",
      `${path}.function`,
      `expected one of ${MATH_FUNCTIONS.join(", ")}`,
      input.function,
    );
  }
  return {
    type: "mathFunction",
    function: input.function as MathFunction,
    value: validateExpression(input.value, `${path}.value`, state),
  };
}

function validateRandomExpression(
  input: Record<string, unknown>,
  path: string,
  state: ValidationState,
  type: "random" | "randomInteger" = "random",
): Expression {
  return {
    type,
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
    case "touchingActor":
      return { type: "touchingActor", actorId: checkText(input.actorId, `${path}.actorId`) };
    case "touchingStageEdge": {
      for (const field of ["minX", "maxX", "minY", "maxY"] as const) {
        if (typeof input[field] !== "number")
          fail("MISSING_FIELD", `${path}.${field}`, "expected a number", input[field]);
        checkBounds(input[field], -1000, 1000, `${path}.${field}`);
      }
      const minX = input.minX as number;
      const maxX = input.maxX as number;
      const minY = input.minY as number;
      const maxY = input.maxY as number;
      if (minX >= maxX || minY >= maxY)
        fail(
          "NUMERIC_OUT_OF_BOUNDS",
          path,
          "stage bounds must have positive width and height",
          input,
        );
      return { type: "touchingStageEdge", minX, maxX, minY, maxY };
    }
    case "distanceToActor":
      return { type: "distanceToActor", actorId: checkText(input.actorId, `${path}.actorId`) };
    case "xPosition":
      return { type: "xPosition" };
    case "yPosition":
      return { type: "yPosition" };
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
    case "modulo":
    case "lessThan":
    case "greaterThan":
    case "lessOrEqual":
    case "greaterOrEqual":
    case "equals":
    case "and":
    case "or":
      return validateBinaryExpression(input, path, state, type);
    case "not":
      return validateUnaryExpression(input, path, state);
    case "listItem":
      return {
        type: "listItem",
        listId: assertKnownListId(input.listId, `${path}.listId`, state),
        index: validateExpression(input.index, `${path}.index`, state),
      };
    case "listLength":
      return {
        type: "listLength",
        listId: assertKnownListId(input.listId, `${path}.listId`, state),
      };
    case "random":
      return validateRandomExpression(input, path, state);
    case "mathFunction":
      return validateMathFunctionExpression(input, path, state);
    case "randomInteger":
      return validateRandomExpression(input, path, state, "randomInteger");
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
    case "goTo": {
      if (typeof input.x !== "number" || typeof input.y !== "number") {
        fail("MISSING_FIELD", path, "expected numeric coordinates", input);
      }
      checkBounds(input.x, -1000, 1000, `${path}.x`);
      checkBounds(input.y, -1000, 1000, `${path}.y`);
      return { type: "goTo", x: input.x, y: input.y };
    }
    case "glideTo": {
      if (
        typeof input.x !== "number" ||
        typeof input.y !== "number" ||
        typeof input.seconds !== "number"
      ) {
        fail("MISSING_FIELD", path, "expected numeric coordinates and seconds", input);
      }
      checkBounds(input.x, -1000, 1000, `${path}.x`);
      checkBounds(input.y, -1000, 1000, `${path}.y`);
      checkBounds(input.seconds, WAIT_SECONDS_MIN, WAIT_SECONDS_MAX, `${path}.seconds`);
      return { type: "glideTo", x: input.x, y: input.y, seconds: input.seconds };
    }
    case "turn": {
      if (typeof input.degrees !== "number") {
        fail("MISSING_FIELD", `${path}.degrees`, "expected a number", input.degrees);
      }
      checkBounds(input.degrees, TURN_DEGREES_MIN, TURN_DEGREES_MAX, `${path}.degrees`);
      return { type: "turn", degrees: input.degrees };
    }
    case "pointInDirection": {
      if (typeof input.degrees !== "number") {
        fail("MISSING_FIELD", `${path}.degrees`, "expected a number", input.degrees);
      }
      checkBounds(input.degrees, -180, 180, `${path}.degrees`);
      return { type: "pointInDirection", degrees: input.degrees };
    }
    case "pointTowards":
      return { type: "pointTowards", actorId: checkText(input.actorId, `${path}.actorId`) };
    case "setEffect": {
      const effect = checkEffect(input.effect, path + ".effect");
      if (typeof input.value !== "number" || !Number.isFinite(input.value)) {
        fail("MISSING_FIELD", path + ".value", "expected a number", input.value);
      }
      const [min, max] = EFFECT_RANGES[effect];
      checkBounds(input.value, min, max, path + ".value");
      return { type: "setEffect", effect, value: input.value };
    }
    case "changeEffect": {
      const effect = checkEffect(input.effect, path + ".effect");
      if (typeof input.delta !== "number" || !Number.isFinite(input.delta)) {
        fail("MISSING_FIELD", path + ".delta", "expected a number", input.delta);
      }
      checkBounds(input.delta, -200, 200, path + ".delta");
      return { type: "changeEffect", effect, delta: input.delta };
    }
    case "clearEffects":
      return { type: "clearEffects" };
    case "goToLayer":
      if (input.layer !== "front" && input.layer !== "back") {
        fail("INVALID_FIELD_TYPE", `${path}.layer`, 'expected "front" or "back"', input.layer);
      }
      return { type: "goToLayer", layer: input.layer };
    case "bounceOnEdge":
      return { type: "bounceOnEdge" };
    case "say":
      return { type: "say", text: checkText(input.text, `${path}.text`) };
    case "think":
      return { type: "think", text: checkText(input.text, `${path}.text`) };
    case "show":
      return { type: "show" };
    case "hide":
      return { type: "hide" };
    case "changeSize": {
      if (typeof input.delta !== "number") {
        fail("MISSING_FIELD", `${path}.delta`, "expected a number", input.delta);
      }
      checkBounds(input.delta, -100, 100, `${path}.delta`);
      return { type: "changeSize", delta: input.delta };
    }
    case "setSize": {
      if (typeof input.size !== "number") {
        fail("MISSING_FIELD", `${path}.size`, "expected a number", input.size);
      }
      checkBounds(input.size, SPRITE_SIZE_MIN, SPRITE_SIZE_MAX, `${path}.size`);
      return { type: "setSize", size: input.size };
    }
    case "wait": {
      if (typeof input.seconds !== "number") {
        fail("MISSING_FIELD", `${path}.seconds`, "expected a number", input.seconds);
      }
      checkBounds(input.seconds, WAIT_SECONDS_MIN, WAIT_SECONDS_MAX, `${path}.seconds`);
      return { type: "wait", seconds: input.seconds };
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
    case "setVolume": {
      if (typeof input.volume !== "number") {
        fail("MISSING_FIELD", `${path}.volume`, "expected a number", input.volume);
      }
      checkBounds(input.volume, 0, 100, `${path}.volume`);
      return { type: "setVolume", volume: input.volume };
    }
    case "changeVolume": {
      if (typeof input.delta !== "number") {
        fail("MISSING_FIELD", `${path}.delta`, "expected a number", input.delta);
      }
      checkBounds(input.delta, -100, 100, `${path}.delta`);
      return { type: "changeVolume", delta: input.delta };
    }
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
    case "listAdd":
      return {
        type: "listAdd",
        listId: assertKnownListId(input.listId, `${path}.listId`, state),
        value: validateExpression(input.value, `${path}.value`, state),
      };
    case "listRemoveAt":
      return {
        type: "listRemoveAt",
        listId: assertKnownListId(input.listId, `${path}.listId`, state),
        index: validateExpression(input.index, `${path}.index`, state),
      };
    case "listInsertAt":
    case "listReplaceAt":
      return {
        type: input.type === "listInsertAt" ? "listInsertAt" : "listReplaceAt",
        listId: assertKnownListId(input.listId, `${path}.listId`, state),
        index: validateExpression(input.index, `${path}.index`, state),
        value: validateExpression(input.value, `${path}.value`, state),
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
    case "callProcedure": {
      if (typeof input.procedureId !== "string" || !state.procedureIds.has(input.procedureId)) {
        fail(
          "INVALID_REFERENCE",
          `${path}.procedureId`,
          "expected the id of a custom block of this script",
          input.procedureId,
        );
      }
      return { type: "callProcedure", procedureId: input.procedureId };
    }
    case "repeatUntil": {
      const nextDepth = depth + 1;
      checkDepth(nextDepth, `${path}.body`);
      return {
        type: "repeatUntil",
        condition: validateExpression(input.condition, `${path}.condition`, state),
        body: validateStatementArray(input.body, `${path}.body`, state, nextDepth),
      };
    }
    case "if": {
      const nextDepth = depth + 1;
      checkDepth(nextDepth, `${path}.then`);
      if (input.else !== undefined) checkDepth(nextDepth, `${path}.else`);
      return {
        type: "if",
        condition: validateExpression(input.condition, `${path}.condition`, state),
        then: validateStatementArray(input.then, `${path}.then`, state, nextDepth),
        ...(input.else === undefined
          ? {}
          : { else: validateStatementArray(input.else, `${path}.else`, state, nextDepth) }),
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
    case "greenFlag":
      return { type: "greenFlag" };
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

function validateList(input: unknown, path: string, state: ValidationState): ProgramList {
  if (!isPlainObject(input)) {
    fail("INVALID_FIELD_TYPE", path, "expected an object", input);
  }
  if (typeof input.id !== "string" || input.id.length === 0) {
    fail("MISSING_FIELD", `${path}.id`, "expected a non-empty string", input.id);
  }
  recordId(state, input.id, `${path}.id`);
  state.listIds.add(input.id);
  const name = checkLimitedText(input.name, `${path}.name`, VARIABLE_NAME_MAX_LENGTH, "list name");
  if (!Array.isArray(input.initialItems)) {
    fail("INVALID_FIELD_TYPE", `${path}.initialItems`, "expected an array", input.initialItems);
  }
  if (input.initialItems.length > LIST_MAX_ITEMS) {
    fail(
      "PROGRAM_TOO_LARGE",
      `${path}.initialItems`,
      `a list holds at most ${LIST_MAX_ITEMS} items`,
      input.initialItems.length,
    );
  }
  const initialItems = input.initialItems.map((item, index) => {
    if (typeof item !== "number") {
      fail("INVALID_FIELD_TYPE", `${path}.initialItems[${index}]`, "expected a number", item);
    }
    checkBounds(item, NUMERIC_LITERAL_MIN, NUMERIC_LITERAL_MAX, `${path}.initialItems[${index}]`);
    return item;
  });
  if (typeof input.visible !== "boolean") {
    fail("MISSING_FIELD", `${path}.visible`, "expected a boolean", input.visible);
  }
  return { id: input.id, name, initialItems, visible: input.visible };
}

const PROCEDURE_NAME = /^[\p{L}\p{N}][\p{L}\p{N} _-]{0,19}$/u;

function validateProcedure(input: unknown, path: string, state: ValidationState): Procedure {
  countNode(state, path);
  if (!isPlainObject(input)) {
    fail("INVALID_FIELD_TYPE", path, "expected an object", input);
  }
  if (typeof input.id !== "string" || input.id.length === 0) {
    fail("MISSING_FIELD", `${path}.id`, "expected a non-empty string", input.id);
  }
  if (typeof input.name !== "string" || !PROCEDURE_NAME.test(input.name)) {
    fail(
      "INVALID_FIELD_TYPE",
      `${path}.name`,
      `expected 1 to ${PROCEDURE_NAME_MAX_LENGTH} letters, digits, spaces, "_" or "-"`,
      input.name,
    );
  }
  recordId(state, input.id, `${path}.id`);
  state.procedureIds.add(input.id);
  return { id: input.id, name: input.name, body: [] };
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
  state.procedureIds = new Set();
  let procedures: Procedure[] | undefined;
  if (input.procedures !== undefined) {
    if (!Array.isArray(input.procedures)) {
      fail("INVALID_FIELD_TYPE", `${path}.procedures`, "expected an array", input.procedures);
    }
    if (input.procedures.length > PROCEDURES_MAX_PER_SCRIPT) {
      fail(
        "PROGRAM_TOO_LARGE",
        `${path}.procedures`,
        `expected at most ${PROCEDURES_MAX_PER_SCRIPT} custom blocks`,
        input.procedures.length,
      );
    }
    const headers = input.procedures.map((item, index) =>
      validateProcedure(item, `${path}.procedures[${index}]`, state),
    );
    procedures = headers.map((header, index) => {
      const raw = (input.procedures as Record<string, unknown>[])[index]!;
      const bodyPath = `${path}.procedures[${index}].body`;
      const body = validateStatementArray(raw.body, bodyPath, state, 2);
      if (body.length < 1 || body.length > PROCEDURE_BODY_MAX) {
        fail(
          "PROGRAM_TOO_LARGE",
          bodyPath,
          `expected 1 to ${PROCEDURE_BODY_MAX} statements`,
          body.length,
        );
      }
      return { ...header, body };
    });
  }
  return {
    id: input.id,
    trigger: validateTrigger(input.trigger, `${path}.trigger`),
    statements: validateStatementArray(input.statements, `${path}.statements`, state, 1),
    ...(procedures === undefined ? {} : { procedures }),
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
  const state: ValidationState = {
    nodeCount: 0,
    seenIds: new Map(),
    variableIds: new Set(),
    listIds: new Set(),
    procedureIds: new Set(),
  };
  const variables =
    input.variables === undefined
      ? undefined
      : Array.isArray(input.variables)
        ? input.variables.map((item, index) =>
            validateVariable(item, `$.variables[${index}]`, state),
          )
        : fail("INVALID_FIELD_TYPE", "$.variables", "expected an array", input.variables);
  const lists =
    input.lists === undefined
      ? undefined
      : Array.isArray(input.lists)
        ? input.lists.map((item, index) => validateList(item, `$.lists[${index}]`, state))
        : fail("INVALID_FIELD_TYPE", "$.lists", "expected an array", input.lists);
  const scripts = input.scripts.map((item, index) =>
    validateScript(item, `$.scripts[${index}]`, state),
  );
  return {
    schema: SCHEMA_VERSION,
    ...(variables === undefined ? {} : { variables }),
    ...(lists === undefined ? {} : { lists }),
    scripts,
  };
}
