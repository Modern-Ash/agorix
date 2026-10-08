/**
 * Runtime operation allowlist (docs/safety/WEB_SECURITY_BASELINE.md).
 *
 * The canonical program interpreter never discovers behaviour dynamically. Every
 * statement, expression and trigger it is allowed to execute is named here, and
 * anything outside this list fails closed with `RuntimeExecutionError` before a
 * single world mutation happens.
 *
 * The allowlist is deliberately *separate* from the program-model schema unions:
 * schema validation proves a program is well formed, the allowlist proves the
 * runtime knows how to execute it. A schema addition that no runtime capability
 * backs must stay rejected here until an explicit allowlist entry is added.
 */
import type { Expression, ProjectProgram, Statement, Trigger } from "@agorix/program-model";
import { RuntimeExecutionError } from "./errors.js";

export const RUNTIME_STATEMENT_OPERATIONS = Object.freeze([
  "move",
  "turn",
  "say",
  "think",
  "show",
  "hide",
  "setSize",
  "switchCostume",
  "switchBackdrop",
  "playSound",
  "stopSounds",
  "broadcast",
  "setVariable",
  "changeVariable",
  "showVariable",
  "hideVariable",
  "repeat",
  "if",
] as const);

export const RUNTIME_EXPRESSION_OPERATIONS = Object.freeze([
  "touchingGoal",
  "booleanLiteral",
  "numericLiteral",
  "variable",
  "add",
  "subtract",
  "multiply",
  "divide",
  "lessThan",
  "greaterThan",
  "equals",
  "and",
  "or",
  "not",
  "random",
] as const);

export const RUNTIME_TRIGGER_OPERATIONS = Object.freeze([
  "greenFlag",
  "onStart",
  "onKeyPressed",
  "onActorClicked",
  "onMessage",
] as const);

export const RUNTIME_OPERATIONS = Object.freeze({
  statement: RUNTIME_STATEMENT_OPERATIONS,
  expression: RUNTIME_EXPRESSION_OPERATIONS,
  trigger: RUNTIME_TRIGGER_OPERATIONS,
} as const);

export type RuntimeOperationKind = keyof typeof RUNTIME_OPERATIONS;
export type RuntimeOperation = (typeof RUNTIME_OPERATIONS)[RuntimeOperationKind][number];

const ALLOWED: Readonly<Record<RuntimeOperationKind, ReadonlySet<string>>> = Object.freeze({
  statement: new Set(RUNTIME_STATEMENT_OPERATIONS),
  expression: new Set(RUNTIME_EXPRESSION_OPERATIONS),
  trigger: new Set(RUNTIME_TRIGGER_OPERATIONS),
});

export function isAllowedRuntimeOperation(kind: RuntimeOperationKind, nodeType: unknown): boolean {
  return typeof nodeType === "string" && ALLOWED[kind].has(nodeType);
}

export function assertAllowedRuntimeOperation(
  kind: RuntimeOperationKind,
  nodeType: unknown,
  path: string,
): void {
  if (!isAllowedRuntimeOperation(kind, nodeType)) {
    throw new RuntimeExecutionError(path, String(nodeType));
  }
}

/** All allowlist entries, flattened, for documentation and completeness tests. */
export function listRuntimeOperations(): readonly RuntimeOperation[] {
  return Object.freeze([
    ...RUNTIME_STATEMENT_OPERATIONS,
    ...RUNTIME_EXPRESSION_OPERATIONS,
    ...RUNTIME_TRIGGER_OPERATIONS,
  ]);
}

function assertExpressionAllowed(expression: Expression, path: string): void {
  assertAllowedRuntimeOperation("expression", expression.type, path);
  switch (expression.type) {
    case "add":
    case "subtract":
    case "multiply":
    case "divide":
    case "lessThan":
    case "greaterThan":
    case "equals":
    case "and":
    case "or":
      assertExpressionAllowed(expression.left, `${path}.left`);
      assertExpressionAllowed(expression.right, `${path}.right`);
      return;
    case "not":
      assertExpressionAllowed(expression.value, `${path}.value`);
      return;
    case "random":
      assertExpressionAllowed(expression.min, `${path}.min`);
      assertExpressionAllowed(expression.max, `${path}.max`);
      return;
    case "touchingGoal":
    case "booleanLiteral":
    case "numericLiteral":
    case "variable":
      return;
  }
}

function assertStatementsAllowed(statements: readonly Statement[], path: string): void {
  for (let i = 0; i < statements.length; i += 1) {
    const statement = statements[i];
    if (statement === undefined) {
      continue;
    }
    const statementPath = `${path}[${i}]`;
    assertAllowedRuntimeOperation("statement", statement.type, statementPath);
    if (statement.type === "repeat") {
      assertStatementsAllowed(statement.body, `${statementPath}.body`);
    } else if (statement.type === "if") {
      assertExpressionAllowed(statement.condition, `${statementPath}.condition`);
      assertStatementsAllowed(statement.then, `${statementPath}.then`);
    } else if (statement.type === "setVariable") {
      assertExpressionAllowed(statement.value, `${statementPath}.value`);
    } else if (statement.type === "changeVariable") {
      assertExpressionAllowed(statement.delta, `${statementPath}.delta`);
    }
  }
}

/**
 * Walks a whole program and fails closed on the first operation outside the
 * allowlist. Called by `runProgram` before execution begins.
 */
export function assertProgramOperationsAllowed(program: ProjectProgram): void {
  const scripts = program?.scripts;
  if (!Array.isArray(scripts)) {
    return;
  }
  for (let i = 0; i < scripts.length; i += 1) {
    const script = scripts[i];
    if (script === undefined) {
      continue;
    }
    const scriptPath = `scripts[${i}]`;
    const trigger: Trigger | undefined = script.trigger;
    if (trigger !== undefined) {
      assertAllowedRuntimeOperation("trigger", trigger.type, `${scriptPath}.trigger`);
    }
    const statements: readonly Statement[] | undefined = script.statements;
    if (Array.isArray(statements)) {
      assertStatementsAllowed(statements, `${scriptPath}.statements`);
    }
  }
}

/** Type-level guard: the allowlist must stay assignable to the schema unions. */
type StatementOperation = (typeof RUNTIME_STATEMENT_OPERATIONS)[number];
type ExpressionOperation = (typeof RUNTIME_EXPRESSION_OPERATIONS)[number];
type TriggerOperation = (typeof RUNTIME_TRIGGER_OPERATIONS)[number];

type _StatementsAreExhaustive = Statement["type"] extends StatementOperation ? true : never;
type _ExpressionsAreExhaustive = Expression["type"] extends ExpressionOperation ? true : never;
type _TriggersAreExhaustive = Trigger["type"] extends TriggerOperation ? true : never;

export type RuntimeOperationAllowlistIsExhaustive = [
  _StatementsAreExhaustive,
  _ExpressionsAreExhaustive,
  _TriggersAreExhaustive,
] extends [true, true, true]
  ? true
  : never;
