import type {
  MathFunction,
  Expression,
  ProgramList,
  ProgramVariable,
  Procedure,
  ProjectProgram,
  Script,
  Statement,
  Trigger,
} from "@agorix/program-model";
import { paramIdentifiers, procedureIdentifiers } from "@agorix/program-model";
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
  /** Custom-block identifiers of the script being projected. */
  procedureNames?: ReadonlyMap<string, string>;
  paramNames?: ReadonlyMap<string, string> | undefined;
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
  lists: readonly ProgramList[] | undefined = undefined,
  texts: readonly { readonly id: string; readonly name: string }[] | undefined = undefined,
): ProjectionContext {
  const variableNames = new Map<string, string>();
  const variableLabels = new Map<string, string>();
  const used = new Set<string>();
  for (const list of lists ?? []) {
    const base = safeIdentifier(list.name, safeIdentifier(list.id, "list"));
    let name = base;
    let suffix = 2;
    while (used.has(name)) {
      name = `${base}${suffix}`;
      suffix += 1;
    }
    used.add(name);
    variableNames.set(`list:${list.id}`, name);
    variableLabels.set(`list:${list.id}`, list.name);
  }
  for (const variable of [...(variables ?? []), ...(texts ?? [])]) {
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

function paramText(context: ProjectionContext, id: string): string {
  return context.paramNames?.get(id) ?? "n_unknown";
}

function formatListName(context: ProjectionContext, listId: string, nodeId: string): string {
  const name = context.variableNames.get(`list:${listId}`);
  if (name === undefined) {
    throw new UnsupportedNodeError(nodeId, "list");
  }
  return name;
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
    case "touchingActor":
      return `sprite.touchingActor(${JSON.stringify(expression.actorId)})`;
    case "touchingColor":
      return `sprite.touchingColor(${JSON.stringify(expression.color)})`;
    case "touchingStageEdge":
      return `sprite.touchingStageEdge(${formatNumber(expression.minX)}, ${formatNumber(expression.maxX)}, ${formatNumber(expression.minY)}, ${formatNumber(expression.maxY)})`;
    case "distanceToActor":
      return `sprite.distanceToActor(${JSON.stringify(expression.actorId)})`;
    case "xPosition":
      return "sprite.x";
    case "direction":
      return "sprite.direction";
    case "yPosition":
      return "sprite.y";
    case "sizePercent":
      return "sprite.size";
    case "timer":
      return "timer()";
    case "keyDown":
      return `keyDown(${JSON.stringify(expression.key)})`;
    case "loudness":
      return "loudness()";
    case "costumeNumber":
      return "costumeNumber()";
    case "backdropNumber":
      return "backdropNumber()";
    case "currentTime":
      return `currentTime(${JSON.stringify(expression.part)})`;
    case "touchingMouse":
      return "sprite.touchingMouse()";
    case "distanceToMouse":
      return "sprite.distanceToMouse()";
    case "mouseX":
      return "mouseX()";
    case "mouseY":
      return "mouseY()";
    case "mouseDown":
      return "mouseDown()";
    case "booleanLiteral":
      return expression.value ? "true" : "false";
    case "numericLiteral":
      return formatNumber(expression.value);
    case "variable":
    case "textVariable":
      return formatVariableName(context, expression.variableId, nodeId);
    case "textLiteral":
      return JSON.stringify(expression.value);
    case "join":
      return `join(${formatExpression(expression.left, `${nodeId}/left`, context)}, ${formatExpression(expression.right, `${nodeId}/right`, context)})`;
    case "textLength":
      return `${formatExpression(expression.value, `${nodeId}/value`, context)}.length`;
    case "letterOf":
      return `letterOf(${formatExpression(expression.index, `${nodeId}/index`, context)}, ${formatExpression(expression.value, `${nodeId}/value`, context)})`;
    case "textContains":
      return `containsText(${formatExpression(expression.text, `${nodeId}/text`, context)}, ${formatExpression(expression.part, `${nodeId}/part`, context)})`;
    case "add":
      return `(${formatExpression(expression.left, `${nodeId}/left`, context)} + ${formatExpression(expression.right, `${nodeId}/right`, context)})`;
    case "subtract":
      return `(${formatExpression(expression.left, `${nodeId}/left`, context)} - ${formatExpression(expression.right, `${nodeId}/right`, context)})`;
    case "multiply":
      return `(${formatExpression(expression.left, `${nodeId}/left`, context)} * ${formatExpression(expression.right, `${nodeId}/right`, context)})`;
    case "divide":
      return `(${formatExpression(expression.left, `${nodeId}/left`, context)} / ${formatExpression(expression.right, `${nodeId}/right`, context)})`;
    case "modulo":
      return `(${formatExpression(expression.left, `${nodeId}/left`, context)} % ${formatExpression(expression.right, `${nodeId}/right`, context)})`;
    case "lessThan":
      return `(${formatExpression(expression.left, `${nodeId}/left`, context)} < ${formatExpression(expression.right, `${nodeId}/right`, context)})`;
    case "greaterThan":
      return `(${formatExpression(expression.left, `${nodeId}/left`, context)} > ${formatExpression(expression.right, `${nodeId}/right`, context)})`;
    case "lessOrEqual":
      return `(${formatExpression(expression.left, `${nodeId}/left`, context)} <= ${formatExpression(expression.right, `${nodeId}/right`, context)})`;
    case "greaterOrEqual":
      return `(${formatExpression(expression.left, `${nodeId}/left`, context)} >= ${formatExpression(expression.right, `${nodeId}/right`, context)})`;
    case "equals":
      return `(${formatExpression(expression.left, `${nodeId}/left`, context)} === ${formatExpression(expression.right, `${nodeId}/right`, context)})`;
    case "and":
      return `(${formatExpression(expression.left, `${nodeId}/left`, context)} && ${formatExpression(expression.right, `${nodeId}/right`, context)})`;
    case "or":
      return `(${formatExpression(expression.left, `${nodeId}/left`, context)} || ${formatExpression(expression.right, `${nodeId}/right`, context)})`;
    case "mathFunction":
      return tsMathCall(
        expression.function,
        formatExpression(expression.value, `${nodeId}/value`, context),
      );
    case "not":
      return `(!${formatExpression(expression.value, `${nodeId}/value`, context)})`;
    case "randomInteger":
      return `randomInteger(${formatExpression(expression.min, `${nodeId}/min`, context)}, ${formatExpression(expression.max, `${nodeId}/max`, context)})`;
    case "listItem":
      return `listItem(${formatListName(context, expression.listId, nodeId)}, ${formatExpression(expression.index, `${nodeId}/index`, context)})`;
    case "listLength":
      return `${formatListName(context, expression.listId, nodeId)}.length`;
    case "listContains":
      return `listContains(${formatListName(context, expression.listId, nodeId)}, ${formatExpression(expression.value, `${nodeId}/value`, context)})`;
    case "listIndexOf":
      return `listIndexOf(${formatListName(context, expression.listId, nodeId)}, ${formatExpression(expression.value, `${nodeId}/value`, context)})`;
    case "param":
      return paramText(context, expression.paramId);
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
  segment: "statements" | "body" | "then" | "else",
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
      write(
        writer,
        `${pad}sprite.move(${statement.stepsFrom === undefined ? formatNumber(statement.steps) : paramText(context, statement.stepsFrom)});\n`,
      );
      return;
    case "glideTo":
      write(
        writer,
        `${pad}sprite.glideTo(${formatNumber(statement.x)}, ${formatNumber(statement.y)}, ${formatNumber(statement.seconds)});\n`,
      );
      return;
    case "nextCostume":
      write(writer, `${pad}sprite.nextCostume(${JSON.stringify(statement.costumeIds)});\n`);
      return;
    case "setRotationStyle":
      write(writer, `${pad}sprite.setRotationStyle(${JSON.stringify(statement.style)});\n`);
      return;
    case "createCopies":
      write(
        writer,
        `${pad}sprite.createCopies(${statement.count}, ${JSON.stringify(statement.rule)}${statement.withScript === true ? ", { withScript: true }" : ""});\n`,
      );
      return;
    case "goToTarget":
      write(
        writer,
        `${pad}sprite.${statement.seconds === undefined ? "goTo" : "glideTo"}${
          statement.target === "random"
            ? "Random"
            : statement.target === "mouse"
              ? "Mouse"
              : "Actor"
        }(${[
          ...(statement.target === "actor" ? [JSON.stringify(statement.actorId)] : []),
          ...(statement.seconds === undefined ? [] : [formatNumber(statement.seconds)]),
        ].join(", ")});\n`,
      );
      return;
    case "setX":
      write(writer, `${pad}sprite.setX(${formatNumber(statement.x)});\n`);
      return;
    case "setY":
      write(writer, `${pad}sprite.setY(${formatNumber(statement.y)});\n`);
      return;
    case "changeX":
      write(writer, `${pad}sprite.changeX(${formatNumber(statement.dx)});\n`);
      return;
    case "changeY":
      write(writer, `${pad}sprite.changeY(${formatNumber(statement.dy)});\n`);
      return;
    case "goTo":
      write(
        writer,
        `${pad}sprite.goTo(${formatNumber(statement.x)}, ${formatNumber(statement.y)});\n`,
      );
      return;
    case "turn":
      write(
        writer,
        `${pad}sprite.turn(${statement.degreesFrom === undefined ? formatNumber(statement.degrees) : paramText(context, statement.degreesFrom)});\n`,
      );
      return;
    case "pointInDirection":
      write(writer, `${pad}sprite.pointInDirection(${formatNumber(statement.degrees)});\n`);
      return;
    case "pointTowards":
      write(writer, `${pad}sprite.pointTowards(${JSON.stringify(statement.actorId)});\n`);
      return;
    case "setEffect":
      write(
        writer,
        `${pad}sprite.setEffect(${JSON.stringify(statement.effect)}, ${formatNumber(statement.value)});\n`,
      );
      return;
    case "changeEffect":
      write(
        writer,
        `${pad}sprite.changeEffect(${JSON.stringify(statement.effect)}, ${formatNumber(statement.delta)});\n`,
      );
      return;
    case "clearEffects":
      write(writer, `${pad}sprite.clearEffects();\n`);
      return;
    case "resetTimer":
      write(writer, `${pad}resetTimer();\n`);
      return;
    case "deleteThisClone":
      write(writer, `${pad}deleteThisClone();\n`);
      return;
    case "penDown":
      write(writer, `${pad}pen.down();\n`);
      return;
    case "penUp":
      write(writer, `${pad}pen.up();\n`);
      return;
    case "clearPen":
      write(writer, `${pad}pen.clear();\n`);
      return;
    case "stamp":
      write(writer, `${pad}pen.stamp();\n`);
      return;
    case "setPenColor":
      write(writer, `${pad}pen.setColor(${JSON.stringify(statement.color)});\n`);
      return;
    case "setPenSize":
      write(writer, `${pad}pen.setSize(${statement.size});\n`);
      return;
    case "setPenShade":
      write(writer, `${pad}pen.setShade(${JSON.stringify(statement.shade)});\n`);
      return;
    case "setPenTransparency":
      write(writer, `${pad}pen.setTransparency(${statement.percent});\n`);
      return;
    case "playNote":
      write(writer, `${pad}music.playNote(${statement.note}, ${statement.beats});\n`);
      return;
    case "playDrum":
      write(
        writer,
        `${pad}music.playDrum(${JSON.stringify(statement.drum)}, ${statement.beats});\n`,
      );
      return;
    case "setInstrument":
      write(writer, `${pad}music.setInstrument(${JSON.stringify(statement.instrument)});\n`);
      return;
    case "setTempo":
      write(writer, `${pad}music.setTempo(${statement.bpm});\n`);
      return;
    case "setPitch":
      write(writer, `${pad}music.setPitch(${statement.semitones});\n`);
      return;
    case "setPan":
      write(writer, `${pad}music.setPan(${statement.pan});\n`);
      return;
    case "goToLayer":
      write(
        writer,
        `${pad}sprite.goToLayer(${JSON.stringify(statement.layer)}${statement.steps === undefined ? "" : `, ${statement.steps}`});\n`,
      );
      return;
    case "callProcedure":
      write(
        writer,
        `${pad}${context.procedureNames?.get(statement.procedureId) ?? "my_block"}(${(statement.args ?? []).map((arg, index) => formatExpression(arg, `${nodeId}/args[${index}]`, context)).join(", ")});\n`,
      );
      return;
    case "bounceOnEdge":
      write(writer, `${pad}sprite.bounceOnEdge();\n`);
      return;
    case "say":
    case "think": {
      const message =
        statement.append === undefined
          ? JSON.stringify(statement.text)
          : `${JSON.stringify(statement.text)} + String(${formatExpression(statement.append, `${nodeId}/append`, context)})`;
      const call =
        statement.seconds === undefined
          ? `${statement.type}(${message})`
          : `${statement.type}For(${message}, ${formatNumber(statement.seconds)})`;
      write(writer, `${pad}sprite.${call};\n`);
      return;
    }
    case "show":
      write(writer, `${pad}sprite.show();\n`);
      return;
    case "hide":
      write(writer, `${pad}sprite.hide();\n`);
      return;
    case "listAdd":
      write(
        writer,
        `${pad}listAdd(${formatListName(context, statement.listId, nodeId)}, ${formatExpression(statement.value, `${nodeId}/value`, context)});\n`,
      );
      return;
    case "listClear":
      write(writer, `${pad}listClear(${formatListName(context, statement.listId, nodeId)});\n`);
      return;
    case "showList":
    case "hideList":
      write(writer, `${pad}${statement.type}(${JSON.stringify(statement.listId)});\n`);
      return;
    case "listRemoveAt":
      write(
        writer,
        `${pad}listRemoveAt(${formatListName(context, statement.listId, nodeId)}, ${formatExpression(statement.index, `${nodeId}/index`, context)});\n`,
      );
      return;
    case "listInsertAt":
    case "listReplaceAt":
      write(
        writer,
        `${pad}${statement.type}(${formatListName(context, statement.listId, nodeId)}, ${formatExpression(statement.index, `${nodeId}/index`, context)}, ${formatExpression(statement.value, `${nodeId}/value`, context)});\n`,
      );
      return;
    case "wait":
      write(
        writer,
        `${pad}wait(${statement.secondsFrom === undefined ? formatNumber(statement.seconds) : paramText(context, statement.secondsFrom)});\n`,
      );
      return;
    case "setSize":
      write(writer, `${pad}sprite.setSize(${formatNumber(statement.size)});\n`);
      return;
    case "changeSize":
      write(writer, `${pad}sprite.changeSize(${formatNumber(statement.delta)});\n`);
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
    case "stop":
      write(writer, `${pad}stop(${JSON.stringify(statement.scope)});\n`);
      return;
    case "askText":
      write(
        writer,
        `${pad}${formatVariableName(context, statement.variableId, nodeId)} = askText(${JSON.stringify(statement.promptId)});\n`,
      );
      return;
    case "askChoice":
      write(
        writer,
        `${pad}${formatVariableName(context, statement.variableId, nodeId)} = askChoice(${JSON.stringify(statement.promptId)});\n`,
      );
      return;
    case "setVolume":
      write(writer, `${pad}sound.setVolume(${statement.volume});\n`);
      return;
    case "changeVolume":
      write(writer, `${pad}sound.changeVolume(${statement.delta});\n`);
      return;
    case "broadcast":
      write(
        writer,
        `${pad}stage.${statement.wait === true ? "broadcastAndWait" : "broadcast"}(${JSON.stringify(statement.message)});\n`,
      );
      return;
    case "setText":
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
      write(
        writer,
        `${pad}repeat(${statement.countFrom === undefined ? formatNumber(statement.count) : `Math.round(${paramText(context, statement.countFrom)})`}, () => {\n`,
      );
      projectStatements(statement.body, nodeId, "body", indent + 1, writer, context);
      write(writer, `${pad}});\n`);
      return;
    }
    case "repeatUntil": {
      const condId = `${nodeId}/condition`;
      const cond = formatExpression(statement.condition, condId, context);
      const prefix = `${pad}repeatUntil(() => `;
      const condStart = writer.offset + prefix.length;
      writer.mapping[condId] = { start: condStart, end: condStart + cond.length };
      write(writer, `${prefix}${cond}, () => {\n`);
      projectStatements(statement.body, nodeId, "body", indent + 1, writer, context);
      write(writer, `${pad}});\n`);
      return;
    }
    case "forever":
      write(writer, `${pad}forever(() => { // bounded by runtime budgets\n`);
      projectStatements(statement.body, nodeId, "body", indent + 1, writer, context);
      write(writer, `${pad}});\n`);
      return;
    case "waitUntil": {
      const condId = `${nodeId}/condition`;
      const cond = formatExpression(statement.condition, condId, context);
      const prefix = `${pad}waitUntil(() => `;
      const condStart = writer.offset + prefix.length;
      writer.mapping[condId] = { start: condStart, end: condStart + cond.length };
      write(writer, `${prefix}${cond}, 10);\n`);
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
      if (statement.else !== undefined) {
        write(writer, `${pad}} else {\n`);
        projectStatements(statement.else, nodeId, "else", indent + 1, writer, context);
      }
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
    case "onBackdropSwitch":
      return `whenBackdropSwitchesTo(${JSON.stringify(trigger.backdropId)})`;
    case "onTimerOver":
      return `whenTimerOver(${trigger.seconds})`;
    case "onCloneStart":
      return "whenIStartAsClone()";
    case "onLoudnessOver":
      return `whenLoudnessOver(${trigger.level})`;
    default: {
      const unknown = trigger as { type?: unknown };
      throw new UnsupportedNodeError(nodeId, String(unknown.type));
    }
  }
}

function projectProcedure(
  procedure: Procedure,
  identifier: string,
  path: string,
  writer: Writer,
  context: ProjectionContext,
): void {
  const start = writer.offset;
  const params = procedure.params ?? [];
  const identifiers = paramIdentifiers(params);
  context.paramNames = new Map(params.map((item, k) => [item.id, identifiers[k]!]));
  write(writer, `function ${identifier}(${identifiers.join(", ")}) {\n`);
  projectStatements(procedure.body, path, "body", 1, writer, context);
  context.paramNames = undefined;
  write(writer, "}\n\n");
  writer.mapping[path] = { start, end: writer.offset };
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
  const context = createProjectionContext(program.variables, program.lists, program.textVariables);
  for (const variable of program.variables ?? []) {
    write(
      writer,
      `let ${formatVariableName(context, variable.id, `variables/${variable.id}`)} = ${formatNumber(variable.initialValue)};\n`,
    );
    if (variable.visible) {
      write(writer, `showVariable(${JSON.stringify(variable.name)});\n`);
    }
  }
  for (const text of program.textVariables ?? []) {
    write(
      writer,
      `let ${formatVariableName(context, text.id, `textVariables/${text.id}`)} = ${JSON.stringify(text.initialValue)};\n`,
    );
    if (text.visible) {
      write(writer, `showVariable(${JSON.stringify(text.name)});\n`);
    }
  }
  for (const list of program.lists ?? []) {
    write(
      writer,
      `const ${formatListName(context, list.id, `lists/${list.id}`)} = [${list.initialItems.map((item) => (typeof item === "string" ? JSON.stringify(item) : formatNumber(item))).join(", ")}];\n`,
    );
    if (list.visible) {
      write(writer, `showList(${JSON.stringify(list.name)});\n`);
    }
  }
  if (
    ((program.variables?.length ?? 0) > 0 ||
      (program.lists?.length ?? 0) > 0 ||
      (program.textVariables?.length ?? 0) > 0) &&
    program.scripts.length > 0
  ) {
    write(writer, "\n");
  }
  // Shared custom blocks are written once, before the scripts that call them.
  const shared = program.sharedProcedures ?? [];
  const sharedNames = procedureIdentifiers(shared);
  context.procedureNames = new Map(shared.map((item, k) => [item.id, sharedNames[k]!]));
  shared.forEach((procedure, k) =>
    projectProcedure(procedure, sharedNames[k]!, `sharedProcedures[${k}]`, writer, context),
  );
  for (let i = 0; i < program.scripts.length; i += 1) {
    const script = program.scripts[i];
    if (script === undefined) {
      continue;
    }
    if (i > 0) {
      write(writer, "\n");
    }
    // The shared blocks come first in the naming, so a script's own block never takes their name.
    const procedures = [...shared, ...(script.procedures ?? [])];
    const identifiers = procedureIdentifiers(procedures);
    context.procedureNames = new Map(procedures.map((item, k) => [item.id, identifiers[k]!]));
    (script.procedures ?? []).forEach((procedure, k) =>
      projectProcedure(
        procedure,
        identifiers[shared.length + k]!,
        `scripts[${i}]/procedures[${k}]`,
        writer,
        context,
      ),
    );
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

/** TypeScript text for a math reporter; angles are in degrees, as in Scratch. */
function tsMathCall(name: MathFunction, value: string): string {
  switch (name) {
    case "ceiling":
      return `Math.ceil(${value})`;
    case "sin":
    case "cos":
    case "tan":
      return `Math.${name}((${value}) * Math.PI / 180)`;
    case "asin":
    case "acos":
    case "atan":
      return `(Math.${name}(${value}) * 180 / Math.PI)`;
    case "ln":
      return `Math.log(${value})`;
    case "log":
      return `Math.log10(${value})`;
    case "pow10":
      return `Math.pow(10, ${value})`;
    default:
      return `Math.${name}(${value})`;
  }
}
