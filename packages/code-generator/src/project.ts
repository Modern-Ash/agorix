import type {
  Expression,
  ProgramVariable,
  ProjectProgram,
  Script,
  Statement,
  Trigger,
} from "@agorix/program-model";
import {
  createUnsupportedNodeDiagnostic,
  firstRangeMapping,
  singleRangeMapping,
  type LanguageProjection,
  type LanguageProjectionDescriptor,
  type LanguageProjectionDiagnostic,
  type LanguageProjectionResult,
  type NodeTextMapping as LanguageNodeTextMapping,
  type TextRange,
} from "@agorix/language-projection";

export type { TextRange } from "@agorix/language-projection";

/** Canonical path-derived node id -> text range, for UI block<->text highlighting. */
export type NodeTextMapping = Readonly<Record<string, TextRange>>;

/** Result of projecting a canonical program into educational source text. */
export interface ProjectionResult {
  readonly code: string;
  readonly mapping: NodeTextMapping;
}

export const TYPESCRIPT_PROJECTION: LanguageProjectionDescriptor = {
  id: "typescript",
  version: "1",
  label: "TypeScript",
  family: "typescript",
};

/** @deprecated Use TYPESCRIPT_PROJECTION. Kept for source compatibility. */
export const TYPESCRIPT_LIKE_PROJECTION = TYPESCRIPT_PROJECTION;

/**
 * Thrown when a node's `type` is not part of the v1 schema (or was corrupted
 * before projection). Fails fast — never returns a partial legacy result.
 */
export class UnsupportedNodeError extends Error {
  readonly nodeId: string;
  readonly nodeType: string;
  readonly diagnostic: LanguageProjectionDiagnostic;

  constructor(nodeId: string, nodeType: string) {
    const diagnostic = createUnsupportedNodeDiagnostic({
      nodeId,
      nodeType,
      projectionId: TYPESCRIPT_PROJECTION.id,
    });
    super(`Unsupported node type ${JSON.stringify(nodeType)} at ${nodeId}`);
    this.name = "UnsupportedNodeError";
    this.nodeId = nodeId;
    this.nodeType = nodeType;
    this.diagnostic = diagnostic;
  }
}

/** Deterministic number formatting for educational output (no locale, `-0` -> `"0"`). */
export function formatNumber(value: number): string {
  if (Object.is(value, -0)) {
    return "0";
  }
  return String(value);
}

interface ProjectionContext {
  readonly variableNames: ReadonlyMap<string, string>;
  readonly variableLabels: ReadonlyMap<string, string>;
}

function safeIdentifier(value: string, fallback: string): string {
  const words = value.match(/[A-Za-z0-9]+/g) ?? [];
  const candidate = words
    .map((word, index) => {
      const lower = word.toLowerCase();
      return index === 0 ? lower : lower[0]?.toUpperCase() + lower.slice(1);
    })
    .join("");
  const identifier = candidate.length > 0 ? candidate : fallback;
  return /^[A-Za-z_]/.test(identifier) ? identifier : `v${identifier}`;
}

function createProjectionContext(
  variables: readonly ProgramVariable[] | undefined,
): ProjectionContext {
  const variableNames = new Map<string, string>();
  const variableLabels = new Map<string, string>();
  const used = new Set<string>();
  for (const variable of variables ?? []) {
    const base = safeIdentifier(variable.name, safeIdentifier(variable.id, "value"));
    let name = base;
    let suffix = 2;
    while (used.has(name)) {
      name = `${base}${suffix}`;
      suffix += 1;
    }
    used.add(name);
    variableNames.set(variable.id, name);
    variableLabels.set(variable.id, variable.name);
  }
  return { variableNames, variableLabels };
}

function formatVariableName(
  context: ProjectionContext,
  variableId: string,
  nodeId: string,
): string {
  const name = context.variableNames.get(variableId);
  if (name === undefined) {
    throw new UnsupportedNodeError(nodeId, "variable");
  }
  return name;
}

function formatExpression(
  expression: Expression,
  nodeId: string,
  context: ProjectionContext,
): string {
  switch (expression.type) {
    case "touchingGoal":
      return "sprite.touchingGoal()";
    case "booleanLiteral":
      return expression.value ? "true" : "false";
    case "numericLiteral":
      return formatNumber(expression.value);
    case "variable":
      return formatVariableName(context, expression.variableId, nodeId);
    case "add":
      return `(${formatExpression(expression.left, `${nodeId}/left`, context)} + ${formatExpression(expression.right, `${nodeId}/right`, context)})`;
    case "subtract":
      return `(${formatExpression(expression.left, `${nodeId}/left`, context)} - ${formatExpression(expression.right, `${nodeId}/right`, context)})`;
    case "multiply":
      return `(${formatExpression(expression.left, `${nodeId}/left`, context)} * ${formatExpression(expression.right, `${nodeId}/right`, context)})`;
    case "divide":
      return `(${formatExpression(expression.left, `${nodeId}/left`, context)} / ${formatExpression(expression.right, `${nodeId}/right`, context)})`;
    case "lessThan":
      return `(${formatExpression(expression.left, `${nodeId}/left`, context)} < ${formatExpression(expression.right, `${nodeId}/right`, context)})`;
    case "greaterThan":
      return `(${formatExpression(expression.left, `${nodeId}/left`, context)} > ${formatExpression(expression.right, `${nodeId}/right`, context)})`;
    case "equals":
      return `(${formatExpression(expression.left, `${nodeId}/left`, context)} === ${formatExpression(expression.right, `${nodeId}/right`, context)})`;
    case "and":
      return `(${formatExpression(expression.left, `${nodeId}/left`, context)} && ${formatExpression(expression.right, `${nodeId}/right`, context)})`;
    case "or":
      return `(${formatExpression(expression.left, `${nodeId}/left`, context)} || ${formatExpression(expression.right, `${nodeId}/right`, context)})`;
    case "not":
      return `(!${formatExpression(expression.value, `${nodeId}/value`, context)})`;
    case "random":
      return `random(${formatExpression(expression.min, `${nodeId}/min`, context)}, ${formatExpression(expression.max, `${nodeId}/max`, context)})`;
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
  context: ProjectionContext,
): void {
  const pad = "  ".repeat(indent);
  for (let i = 0; i < statements.length; i += 1) {
    const statement = statements[i];
    if (statement === undefined) {
      continue;
    }
    const nodeId = `${path}/${segment}[${i}]`;
    const start = writer.offset;
    projectStatement(statement, nodeId, pad, indent, writer, context);
    writer.mapping[nodeId] = { start, end: writer.offset };
  }
}

function projectStatement(
  statement: Statement,
  nodeId: string,
  pad: string,
  indent: number,
  writer: Writer,
  context: ProjectionContext,
): void {
  switch (statement.type) {
    case "move":
      write(writer, `${pad}sprite.move(${formatNumber(statement.steps)});\n`);
      return;
    case "turn":
      write(writer, `${pad}sprite.turn(${formatNumber(statement.degrees)});\n`);
      return;
    case "say":
      write(writer, `${pad}sprite.say(${JSON.stringify(statement.text)});\n`);
      return;
    case "think":
      write(writer, `${pad}sprite.think(${JSON.stringify(statement.text)});\n`);
      return;
    case "show":
      write(writer, `${pad}sprite.show();\n`);
      return;
    case "hide":
      write(writer, `${pad}sprite.hide();\n`);
      return;
    case "setSize":
      write(writer, `${pad}sprite.setSize(${formatNumber(statement.size)});\n`);
      return;
    case "switchCostume":
      write(writer, `${pad}sprite.switchCostume(${JSON.stringify(statement.costumeId)});\n`);
      return;
    case "switchBackdrop":
      write(writer, `${pad}stage.switchBackdrop(${JSON.stringify(statement.backdropId)});\n`);
      return;
    case "playSound":
      write(writer, `${pad}sound.play(${JSON.stringify(statement.soundId)});\n`);
      return;
    case "stopSounds":
      write(writer, `${pad}sound.stopAll();\n`);
      return;
    case "broadcast":
      write(writer, `${pad}stage.broadcast(${JSON.stringify(statement.message)});\n`);
      return;
    case "setVariable":
      write(
        writer,
        `${pad}${formatVariableName(context, statement.variableId, nodeId)} = ${formatExpression(statement.value, `${nodeId}/value`, context)};\n`,
      );
      return;
    case "changeVariable":
      write(
        writer,
        `${pad}${formatVariableName(context, statement.variableId, nodeId)} += ${formatExpression(statement.delta, `${nodeId}/delta`, context)};\n`,
      );
      return;
    case "showVariable":
      write(
        writer,
        `${pad}showVariable(${JSON.stringify(context.variableLabels.get(statement.variableId) ?? statement.variableId)});\n`,
      );
      return;
    case "hideVariable":
      write(
        writer,
        `${pad}hideVariable(${JSON.stringify(context.variableLabels.get(statement.variableId) ?? statement.variableId)});\n`,
      );
      return;
    case "repeat": {
      write(writer, `${pad}repeat(${formatNumber(statement.count)}, () => {\n`);
      projectStatements(statement.body, nodeId, "body", indent + 1, writer, context);
      write(writer, `${pad}});\n`);
      return;
    }
    case "if": {
      const condId = `${nodeId}/condition`;
      const cond = formatExpression(statement.condition, condId, context);
      const lineStart = writer.offset;
      const prefix = `${pad}if (`;
      const condStart = lineStart + prefix.length;
      const condEnd = condStart + cond.length;
      writer.mapping[condId] = { start: condStart, end: condEnd };
      write(writer, `${prefix}${cond}) {\n`);
      projectStatements(statement.then, nodeId, "then", indent + 1, writer, context);
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
    case "greenFlag":
      return "whenGreenFlagClicked";
    case "onStart":
      return "whenStarted";
    case "onKeyPressed":
      return `whenKeyPressed(${JSON.stringify(trigger.key)})`;
    case "onActorClicked":
      return "whenActorClicked";
    case "onMessage":
      return `whenMessageReceived(${JSON.stringify(trigger.message)})`;
    default: {
      const unknown = trigger as { type?: unknown };
      throw new UnsupportedNodeError(nodeId, String(unknown.type));
    }
  }
}

function projectScript(
  script: Script,
  index: number,
  writer: Writer,
  context: ProjectionContext,
): void {
  const scriptPath = `scripts[${index}]`;
  const triggerId = `${scriptPath}/trigger`;
  const trigger = projectTrigger(script.trigger, triggerId);
  const start = writer.offset;
  writer.mapping[triggerId] = { start, end: start + trigger.length };
  write(writer, `${trigger}(() => {\n`);
  projectStatements(script.statements, scriptPath, "statements", 1, writer, context);
  write(writer, "});\n");
  writer.mapping[scriptPath] = { start, end: writer.offset };
}

function projectText(program: ProjectProgram): {
  readonly text: string;
  readonly mapping: LanguageNodeTextMapping;
} {
  const writer: Writer = { parts: [], offset: 0, mapping: {} };
  const context = createProjectionContext(program.variables);
  for (const variable of program.variables ?? []) {
    write(
      writer,
      `let ${formatVariableName(context, variable.id, `variables/${variable.id}`)} = ${formatNumber(variable.initialValue)};\n`,
    );
    if (variable.visible) {
      write(writer, `showVariable(${JSON.stringify(variable.name)});\n`);
    }
  }
  if ((program.variables?.length ?? 0) > 0 && program.scripts.length > 0) {
    write(writer, "\n");
  }
  for (let i = 0; i < program.scripts.length; i += 1) {
    const script = program.scripts[i];
    if (script === undefined) {
      continue;
    }
    if (i > 0) {
      write(writer, "\n");
    }
    projectScript(script, i, writer, context);
  }
  return { text: writer.parts.join(""), mapping: singleRangeMapping(writer.mapping) };
}

export const typescriptProjection: LanguageProjection = {
  descriptor: TYPESCRIPT_PROJECTION,
  project(program: ProjectProgram): LanguageProjectionResult {
    const projected = projectText(program);
    return {
      projection: TYPESCRIPT_LIKE_PROJECTION,
      text: projected.text,
      mapping: projected.mapping,
      diagnostics: [],
      metadata: { structuralNodeIds: Object.keys(projected.mapping) },
    };
  },
};

/** Projects a canonical program into the new LanguageProjection contract. */
/** @deprecated Use typescriptProjection. Kept for source compatibility. */
export const typescriptLikeProjection = typescriptProjection;

export function projectProgramLanguage(program: ProjectProgram): LanguageProjectionResult {
  return typescriptProjection.project(program);
}

/**
 * Projects a canonical `ProjectProgram` into readable educational
 * TypeScript/JavaScript-like code with a node->text-range mapping.
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
  const result = projectProgramLanguage(program);
  return { code: result.text, mapping: firstRangeMapping(result.mapping) };
}
