import type { Expression, ProjectProgram, Script, Statement, Trigger } from "@agorix/program-model";

/** Half-open character range into `ProjectionResult.code` (start inclusive, end exclusive). */
export interface TextRange {
  readonly start: number;
  readonly end: number;
}

/** Canonical path-derived node id → text range, for UI block↔text highlighting. */
export type NodeTextMapping = Readonly<Record<string, TextRange>>;

/** Result of projecting a canonical program into educational source text. */
export interface ProjectionResult {
  readonly code: string;
  readonly mapping: NodeTextMapping;
}

/**
 * Thrown when a node's `type` is not part of the v1 schema (or was corrupted
 * before projection). Fails fast — never returns a partial result.
 */
export class UnsupportedNodeError extends Error {
  readonly nodeId: string;
  readonly nodeType: string;

  constructor(nodeId: string, nodeType: string) {
    super(`Unsupported node type ${JSON.stringify(nodeType)} at ${nodeId}`);
    this.name = "UnsupportedNodeError";
    this.nodeId = nodeId;
    this.nodeType = nodeType;
  }
}

/** Deterministic number formatting for educational output (no locale, `-0` → `"0"`). */
export function formatNumber(value: number): string {
  if (Object.is(value, -0)) {
    return "0";
  }
  return String(value);
}

function formatExpression(expression: Expression, nodeId: string): string {
  switch (expression.type) {
    case "touchingGoal":
      return "sprite.touchingGoal()";
    case "booleanLiteral":
      return expression.value ? "true" : "false";
    case "numericLiteral":
      return formatNumber(expression.value);
    default: {
      const unknown = expression as { type?: unknown };
      throw new UnsupportedNodeError(nodeId, String(unknown.type));
    }
  }
}

interface Writer {
  readonly parts: string[];
  offset: number;
  readonly mapping: Record<string, TextRange>;
}

function write(writer: Writer, text: string): void {
  writer.parts.push(text);
  writer.offset += text.length;
}

function projectStatements(
  statements: readonly Statement[],
  path: string,
  segment: "statements" | "body" | "then",
  indent: number,
  writer: Writer,
): void {
  const pad = "  ".repeat(indent);
  for (let i = 0; i < statements.length; i += 1) {
    const statement = statements[i];
    if (statement === undefined) {
      continue;
    }
    const nodeId = `${path}/${segment}[${i}]`;
    const start = writer.offset;
    projectStatement(statement, nodeId, pad, indent, writer);
    writer.mapping[nodeId] = { start, end: writer.offset };
  }
}

function projectStatement(
  statement: Statement,
  nodeId: string,
  pad: string,
  indent: number,
  writer: Writer,
): void {
  switch (statement.type) {
    case "move":
      write(writer, `${pad}sprite.move(${formatNumber(statement.steps)});\n`);
      return;
    case "turn":
      write(writer, `${pad}sprite.turn(${formatNumber(statement.degrees)});\n`);
      return;
    case "repeat": {
      write(writer, `${pad}repeat(${formatNumber(statement.count)}, () => {\n`);
      projectStatements(statement.body, nodeId, "body", indent + 1, writer);
      write(writer, `${pad}});\n`);
      return;
    }
    case "if": {
      const condId = `${nodeId}/condition`;
      const cond = formatExpression(statement.condition, condId);
      const lineStart = writer.offset;
      const prefix = `${pad}if (`;
      const condStart = lineStart + prefix.length;
      const condEnd = condStart + cond.length;
      writer.mapping[condId] = { start: condStart, end: condEnd };
      write(writer, `${prefix}${cond}) {\n`);
      projectStatements(statement.then, nodeId, "then", indent + 1, writer);
      write(writer, `${pad}}\n`);
      return;
    }
    default: {
      const unknown = statement as { type?: unknown };
      throw new UnsupportedNodeError(nodeId, String(unknown.type));
    }
  }
}

function projectTrigger(trigger: Trigger, nodeId: string): string {
  switch (trigger.type) {
    case "onStart":
      return "whenStarted";
    default: {
      const unknown = trigger as { type?: unknown };
      throw new UnsupportedNodeError(nodeId, String(unknown.type));
    }
  }
}

function projectScript(script: Script, index: number, writer: Writer): void {
  const scriptPath = `scripts[${index}]`;
  const triggerId = `${scriptPath}/trigger`;
  const trigger = projectTrigger(script.trigger, triggerId);
  const start = writer.offset;
  writer.mapping[triggerId] = { start, end: start + trigger.length };
  write(writer, `${trigger}(() => {\n`);
  projectStatements(script.statements, scriptPath, "statements", 1, writer);
  write(writer, "});\n");
  writer.mapping[scriptPath] = { start, end: writer.offset };
}

/**
 * Projects a canonical `ProjectProgram` into readable educational
 * TypeScript/JavaScript-like code with a node→text-range mapping.
 *
 * Pure: does not mutate `program`, performs no I/O. Same program structure
 * always yields byte-identical `code` and identical `mapping`.
 *
 * Format contract (deterministic): two-space indent, one statement per line,
 * trailing newline on `code`.
 *
 * @throws {UnsupportedNodeError} on the first unknown trigger/statement/expression `type`.
 */
export function projectProgram(program: ProjectProgram): ProjectionResult {
  const writer: Writer = { parts: [], offset: 0, mapping: {} };
  for (let i = 0; i < program.scripts.length; i += 1) {
    const script = program.scripts[i];
    if (script === undefined) {
      continue;
    }
    if (i > 0) {
      write(writer, "\n");
    }
    projectScript(script, i, writer);
  }
  return { code: writer.parts.join(""), mapping: writer.mapping };
}
