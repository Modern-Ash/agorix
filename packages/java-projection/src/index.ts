import {
  createUnsupportedNodeDiagnostic,
  type LanguageProjection,
  type LanguageProjectionDiagnostic,
  type LanguageProjectionResult,
  type LanguagePack,
  type NodeTextMapping,
  type TextRange,
} from "@agorix/language-projection";
import {
  paramIdentifiers,
  procedureIdentifiers,
  validateProgram,
  type Expression,
  type ProjectProgram,
  type Statement,
  type Trigger,
} from "@agorix/program-model";

export const JAVA_PROJECTION = {
  id: "java",
  version: "2",
  label: "Java",
  family: "java",
} as const;

/**
 * The methods a program can call, all inherited from `Sprite`. The text is a display-only view of
 * the canonical program: it is never compiled or run by the product, and the deterministic runtime
 * executes the canonical program. The names stay stable so a test can compile the text against a
 * stub of this API.
 */
export const JAVA_SUPPORT_API = [
  "move",
  "goTo",
  "glideTo",
  "turn",
  "pointInDirection",
  "pointTowards",
  "bounceOnEdge",
  "goToLayer",
  "setEffect",
  "changeEffect",
  "clearEffects",
  "say",
  "think",
  "show",
  "hide",
  "setSize",
  "changeSize",
  "waitSeconds",
  "switchCostume",
  "switchBackdrop",
  "playSound",
  "stopSounds",
  "setVolume",
  "changeVolume",
  "broadcast",
  "showVariable",
  "hideVariable",
  "showList",
  "listRemoveAt",
  "listInsertAt",
  "listReplaceAt",
  "listItem",
  "penDown",
  "penUp",
  "setPenColor",
  "setPenSize",
  "clearPen",
  "touchingGoal",
  "touchingActor",
  "touchingStageEdge",
  "distanceToActor",
  "xPosition",
  "yPosition",
  "timer",
  "keyDown",
  "random",
  "randomInteger",
] as const;

/**
 * A stub of the base class, with every method of the support API doing nothing. A program's Java text
 * compiles against it, which is how the tests prove the view is valid Java.
 */
export const JAVA_SUPPORT_STUB = `class Sprite {
    void move(double steps) {}
    void goTo(double x, double y) {}
    void glideTo(double x, double y, double seconds) {}
    void turn(double degrees) {}
    void pointInDirection(double degrees) {}
    void pointTowards(String actor) {}
    void bounceOnEdge() {}
    void goToLayer(String layer) {}
    void setEffect(String effect, double value) {}
    void changeEffect(String effect, double delta) {}
    void clearEffects() {}
    void say(String text) {}
    void think(String text) {}
    void show() {}
    void hide() {}
    void setSize(double size) {}
    void changeSize(double delta) {}
    void waitSeconds(double seconds) {}
    void switchCostume(String costume) {}
    void switchBackdrop(String backdrop) {}
    void playSound(String sound) {}
    void stopSounds() {}
    void setVolume(double volume) {}
    void changeVolume(double delta) {}
    void broadcast(String message) {}
    void showVariable(String name) {}
    void hideVariable(String name) {}
    void showList(String name) {}
    void listRemoveAt(java.util.List<Double> list, double index) {}
    void listInsertAt(java.util.List<Double> list, double index, double value) {}
    void listReplaceAt(java.util.List<Double> list, double index, double value) {}
    double listItem(java.util.List<Double> list, double index) { return 0; }
    void penDown() {}
    void penUp() {}
    void setPenColor(String color) {}
    void setPenSize(double size) {}
    void clearPen() {}
    boolean touchingGoal() { return false; }
    boolean touchingActor(String actor) { return false; }
    boolean touchingStageEdge(double minX, double maxX, double minY, double maxY) { return false; }
    double distanceToActor(String actor) { return 0; }
    double xPosition() { return 0; }
    double yPosition() { return 0; }
    double timer() { return 0; }
    boolean keyDown(String key) { return false; }
    double random(double min, double max) { return 0; }
    double randomInteger(double min, double max) { return 0; }
}
`;

interface Writer {
  text: string;
  mapping: Record<string, TextRange[]>;
  diagnostics: LanguageProjectionDiagnostic[];
  variableNames: ReadonlyMap<string, string>;
  listNames: ReadonlyMap<string, string>;
  procedureNames: ReadonlyMap<string, string>;
  paramNames: ReadonlyMap<string, string> | undefined;
}

type Kind = "number" | "boolean";

const INDENT = "    ";

function addRange(writer: Writer, nodeId: string, start: number, end: number): void {
  (writer.mapping[nodeId] ??= []).push({ start, end });
}

function mapped(writer: Writer, nodeId: string, line: string): void {
  const start = writer.text.length;
  writer.text += line;
  addRange(writer, nodeId, start, writer.text.length);
}

function unsupported(writer: Writer, nodeId: string, type: string, indent = INDENT): void {
  writer.diagnostics.push(
    createUnsupportedNodeDiagnostic({ nodeId, nodeType: type, projectionId: JAVA_PROJECTION.id }),
  );
  writer.text += `${indent}// ${type} is not available in this Java view.\n`;
}

function number(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(6)));
}

/** A number as a Java double literal: `3` becomes `3.0`. */
function doubleLiteral(value: number): string {
  const text = number(value);
  return /^-?\d+$/.test(text) ? `${text}.0` : text;
}

function literal(value: string): string {
  return JSON.stringify(value);
}

// --- identifiers -----------------------------------------------------------------------------

const JAVA_RESERVED = new Set([
  "abstract",
  "assert",
  "boolean",
  "break",
  "byte",
  "case",
  "catch",
  "char",
  "class",
  "const",
  "continue",
  "default",
  "do",
  "double",
  "else",
  "enum",
  "extends",
  "final",
  "finally",
  "float",
  "for",
  "goto",
  "if",
  "implements",
  "import",
  "instanceof",
  "int",
  "interface",
  "long",
  "native",
  "new",
  "package",
  "private",
  "protected",
  "public",
  "return",
  "short",
  "static",
  "strictfp",
  "super",
  "switch",
  "synchronized",
  "this",
  "throw",
  "throws",
  "transient",
  "try",
  "void",
  "volatile",
  "while",
  "true",
  "false",
  "null",
  "var",
  "record",
  "yield",
]);

function safeIdentifier(value: string, fallback: string): string {
  const words = value.match(/[A-Za-z0-9]+/g) ?? [];
  const candidate = words
    .map((word, index) => {
      const lower = word.toLowerCase();
      return index === 0 ? lower : lower[0]!.toUpperCase() + lower.slice(1);
    })
    .join("");
  const identifier = candidate.length > 0 ? candidate : fallback;
  const valid = /^[A-Za-z_]/.test(identifier) ? identifier : `v${identifier}`;
  return JAVA_RESERVED.has(valid) || (JAVA_SUPPORT_API as readonly string[]).includes(valid)
    ? `${valid}_`
    : valid;
}

function namesFor(
  items: readonly { id: string; name: string }[] | undefined,
  taken: ReadonlySet<string> = new Set(),
): ReadonlyMap<string, string> {
  const names = new Map<string, string>();
  const used = new Set<string>(taken);
  for (const item of items ?? []) {
    const base = safeIdentifier(item.name, safeIdentifier(item.id, "value"));
    let name = base;
    for (let n = 2; used.has(name); n += 1) name = `${base}${n}`;
    used.add(name);
    names.set(item.id, name);
  }
  return names;
}

function camel(value: string): string {
  const words = value.match(/[A-Za-z0-9]+/g) ?? [];
  return words.map((word) => word[0]!.toUpperCase() + word.slice(1)).join("");
}

function handlerName(trigger: Trigger): string {
  switch (trigger.type) {
    case "greenFlag":
    case "onStart":
      return "onStart";
    case "onActorClicked":
      return "onActorClicked";
    case "onKeyPressed":
      return `onKeyPressed${camel(trigger.key) || "Key"}`;
    case "onMessage":
      return `onMessage${camel(trigger.message) || "Message"}`;
  }
}

// --- expressions -----------------------------------------------------------------------------

/** Whether an expression is a number or a true/false value, as the canonical runtime coerces them. */
function kindOf(expression: Expression): Kind {
  switch (expression.type) {
    case "touchingGoal":
    case "touchingActor":
    case "touchingStageEdge":
    case "keyDown":
    case "booleanLiteral":
    case "lessThan":
    case "greaterThan":
    case "lessOrEqual":
    case "greaterOrEqual":
    case "equals":
    case "and":
    case "or":
    case "not":
      return "boolean";
    default:
      return "number";
  }
}

function asNumber(writer: Writer, expression: Expression, nodeId: string): string {
  const text = expressionText(writer, expression, nodeId);
  return kindOf(expression) === "boolean" ? `(${text} ? 1 : 0)` : text;
}

function asBoolean(writer: Writer, expression: Expression, nodeId: string): string {
  const text = expressionText(writer, expression, nodeId);
  return kindOf(expression) === "boolean" ? text : `(${text} != 0)`;
}

function paramText(writer: Writer, id: string): string {
  return writer.paramNames?.get(id) ?? "n_unknown";
}

function variableName(writer: Writer, id: string): string {
  return writer.variableNames.get(id) ?? safeIdentifier(id, "value");
}

function listName(writer: Writer, id: string): string {
  return writer.listNames.get(id) ?? safeIdentifier(id, "items");
}

function expressionText(writer: Writer, expression: Expression, nodeId: string): string {
  const sides = (operator: string, left: Expression, right: Expression, kind: Kind) => {
    const read = kind === "number" ? asNumber : asBoolean;
    return `(${read(writer, left, `${nodeId}/left`)} ${operator} ${read(writer, right, `${nodeId}/right`)})`;
  };
  switch (expression.type) {
    case "touchingGoal":
      return "touchingGoal()";
    case "touchingActor":
      return `touchingActor(${literal(expression.actorId)})`;
    case "touchingStageEdge":
      return `touchingStageEdge(${number(expression.minX)}, ${number(expression.maxX)}, ${number(expression.minY)}, ${number(expression.maxY)})`;
    case "distanceToActor":
      return `distanceToActor(${literal(expression.actorId)})`;
    case "xPosition":
      return "xPosition()";
    case "yPosition":
      return "yPosition()";
    case "timer":
      return "timer()";
    case "keyDown":
      return `keyDown(${literal(expression.key)})`;
    case "booleanLiteral":
      return expression.value ? "true" : "false";
    case "numericLiteral":
      return number(expression.value);
    case "variable":
      return variableName(writer, expression.variableId);
    case "param":
      return paramText(writer, expression.paramId);
    case "add":
      return sides("+", expression.left, expression.right, "number");
    case "subtract":
      return sides("-", expression.left, expression.right, "number");
    case "multiply":
      return sides("*", expression.left, expression.right, "number");
    case "divide":
      return sides("/", expression.left, expression.right, "number");
    case "modulo":
      return sides("%", expression.left, expression.right, "number");
    case "lessThan":
      return sides("<", expression.left, expression.right, "number");
    case "greaterThan":
      return sides(">", expression.left, expression.right, "number");
    case "lessOrEqual":
      return sides("<=", expression.left, expression.right, "number");
    case "greaterOrEqual":
      return sides(">=", expression.left, expression.right, "number");
    case "equals":
      return sides("==", expression.left, expression.right, "number");
    case "and":
      return sides("&&", expression.left, expression.right, "boolean");
    case "or":
      return sides("||", expression.left, expression.right, "boolean");
    case "not":
      return `(!${asBoolean(writer, expression.value, `${nodeId}/value`)})`;
    case "mathFunction": {
      const value = asNumber(writer, expression.value, `${nodeId}/value`);
      const name = { abs: "abs", round: "round", floor: "floor", ceiling: "ceil" }[
        expression.function
      ];
      return `Math.${name}(${value})`;
    }
    case "random":
      return `random(${asNumber(writer, expression.min, `${nodeId}/min`)}, ${asNumber(writer, expression.max, `${nodeId}/max`)})`;
    case "randomInteger":
      return `randomInteger(${asNumber(writer, expression.min, `${nodeId}/min`)}, ${asNumber(writer, expression.max, `${nodeId}/max`)})`;
    case "listItem":
      return `listItem(${listName(writer, expression.listId)}, ${asNumber(writer, expression.index, `${nodeId}/index`)})`;
    case "listLength":
      return `${listName(writer, expression.listId)}.size()`;
    default: {
      const unknown = expression as { type?: unknown };
      writer.diagnostics.push(
        createUnsupportedNodeDiagnostic({
          nodeId,
          nodeType: String(unknown.type),
          projectionId: JAVA_PROJECTION.id,
        }),
      );
      return "false";
    }
  }
}

// --- statements ------------------------------------------------------------------------------

function block(
  writer: Writer,
  nodeId: string,
  list: readonly Statement[],
  branch: string,
  depth: number,
): void {
  list.forEach((child, index) => statement(writer, child, `${nodeId}/${branch}[${index}]`, depth));
}

function statement(writer: Writer, node: Statement, nodeId: string, depth: number): void {
  const indent = INDENT.repeat(depth);
  const line = (text: string) => mapped(writer, nodeId, `${indent}${text};\n`);
  const num = (value: Expression, suffix = "") => asNumber(writer, value, `${nodeId}/${suffix}`);
  switch (node.type) {
    case "move":
      return line(
        `move(${node.stepsFrom === undefined ? number(node.steps) : paramText(writer, node.stepsFrom)})`,
      );
    case "goTo":
      return line(`goTo(${number(node.x)}, ${number(node.y)})`);
    case "glideTo":
      return line(`glideTo(${number(node.x)}, ${number(node.y)}, ${number(node.seconds)})`);
    case "turn":
      return line(
        `turn(${node.degreesFrom === undefined ? number(node.degrees) : paramText(writer, node.degreesFrom)})`,
      );
    case "pointInDirection":
      return line(`pointInDirection(${number(node.degrees)})`);
    case "pointTowards":
      return line(`pointTowards(${literal(node.actorId)})`);
    case "bounceOnEdge":
      return line("bounceOnEdge()");
    case "goToLayer":
      return line(`goToLayer(${literal(node.layer)})`);
    case "setEffect":
      return line(`setEffect(${literal(node.effect)}, ${number(node.value)})`);
    case "changeEffect":
      return line(`changeEffect(${literal(node.effect)}, ${number(node.delta)})`);
    case "clearEffects":
      return line("clearEffects()");
    case "say":
      return line(`say(${literal(node.text)})`);
    case "think":
      return line(`think(${literal(node.text)})`);
    case "show":
      return line("show()");
    case "hide":
      return line("hide()");
    case "setSize":
      return line(`setSize(${number(node.size)})`);
    case "changeSize":
      return line(`changeSize(${number(node.delta)})`);
    case "wait":
      return line(
        `waitSeconds(${node.secondsFrom === undefined ? number(node.seconds) : paramText(writer, node.secondsFrom)})`,
      );
    case "switchCostume":
      return line(`switchCostume(${literal(node.costumeId)})`);
    case "switchBackdrop":
      return line(`switchBackdrop(${literal(node.backdropId)})`);
    case "playSound":
      return line(`playSound(${literal(node.soundId)})`);
    case "stopSounds":
      return line("stopSounds()");
    case "setVolume":
      return line(`setVolume(${number(node.volume)})`);
    case "changeVolume":
      return line(`changeVolume(${number(node.delta)})`);
    case "broadcast":
      return line(`broadcast(${literal(node.message)})`);
    case "setVariable":
      return line(`${variableName(writer, node.variableId)} = ${num(node.value, "value")}`);
    case "changeVariable":
      return line(`${variableName(writer, node.variableId)} += ${num(node.delta, "delta")}`);
    case "showVariable":
      return line(`showVariable(${literal(variableName(writer, node.variableId))})`);
    case "hideVariable":
      return line(`hideVariable(${literal(variableName(writer, node.variableId))})`);
    case "listAdd":
      return line(`${listName(writer, node.listId)}.add((double) ${num(node.value, "value")})`);
    case "listRemoveAt":
      return line(`listRemoveAt(${listName(writer, node.listId)}, ${num(node.index, "index")})`);
    case "listInsertAt":
      return line(
        `listInsertAt(${listName(writer, node.listId)}, ${num(node.index, "index")}, ${num(node.value, "value")})`,
      );
    case "listReplaceAt":
      return line(
        `listReplaceAt(${listName(writer, node.listId)}, ${num(node.index, "index")}, ${num(node.value, "value")})`,
      );
    case "penDown":
      return line("penDown()");
    case "penUp":
      return line("penUp()");
    case "clearPen":
      return line("clearPen()");
    case "setPenColor":
      return line(`setPenColor(${literal(node.color)})`);
    case "setPenSize":
      return line(`setPenSize(${node.size})`);
    case "callProcedure": {
      const args = (node.args ?? []).map((arg, index) =>
        asNumber(writer, arg, `${nodeId}/args[${index}]`),
      );
      return line(
        `${writer.procedureNames.get(node.procedureId) ?? "myBlock"}(${args.join(", ")})`,
      );
    }
    case "repeat": {
      const start = writer.text.length;
      const count =
        node.countFrom === undefined
          ? number(node.count)
          : `(int) Math.round(${paramText(writer, node.countFrom)})`;
      writer.text += `${indent}for (int i${depth} = 0; i${depth} < ${count}; i${depth}++) {\n`;
      block(writer, nodeId, node.body, "body", depth + 1);
      writer.text += `${indent}}\n`;
      addRange(writer, nodeId, start, writer.text.length);
      return;
    }
    case "repeatUntil": {
      const start = writer.text.length;
      writer.text += `${indent}while (!${asBoolean(writer, node.condition, `${nodeId}/condition`)}) {\n`;
      block(writer, nodeId, node.body, "body", depth + 1);
      writer.text += `${indent}}\n`;
      addRange(writer, nodeId, start, writer.text.length);
      return;
    }
    case "if": {
      const start = writer.text.length;
      writer.text += `${indent}if (${asBoolean(writer, node.condition, `${nodeId}/condition`)}) {\n`;
      block(writer, nodeId, node.then, "then", depth + 1);
      if (node.else !== undefined) {
        writer.text += `${indent}} else {\n`;
        block(writer, nodeId, node.else, "else", depth + 1);
      }
      writer.text += `${indent}}\n`;
      addRange(writer, nodeId, start, writer.text.length);
      return;
    }
    default: {
      const unknown = node as { type?: unknown };
      unsupported(writer, nodeId, String(unknown.type), indent);
    }
  }
}

/** Display-only Java view. The canonical program remains the runtime authority. */
export function projectJava(program: ProjectProgram): LanguageProjectionResult {
  const validated = validateProgram(program);
  const variableNames = namesFor(
    validated.variables,
    new Set(Array.from({ length: 10 }, (_item, depth) => `i${depth}`)),
  );
  const writer: Writer = {
    text: "class AgorixProgram extends Sprite {\n",
    mapping: {},
    diagnostics: [],
    variableNames,
    listNames: namesFor(validated.lists, new Set(variableNames.values())),
    procedureNames: new Map(),
    paramNames: undefined,
  };
  for (const variable of validated.variables ?? []) {
    mapped(
      writer,
      `variables/${variable.id}`,
      `${INDENT}double ${variableName(writer, variable.id)} = ${number(variable.initialValue)};\n`,
    );
  }
  for (const list of validated.lists ?? []) {
    const initial =
      list.initialItems.length === 0
        ? "new java.util.ArrayList<>()"
        : `new java.util.ArrayList<>(java.util.List.of(${list.initialItems.map(doubleLiteral).join(", ")}))`;
    mapped(
      writer,
      `lists/${list.id}`,
      `${INDENT}java.util.ArrayList<Double> ${listName(writer, list.id)} = ${initial};\n`,
    );
  }
  const methods = new Set<string>();
  const unique = (base: string, scriptIndex: number): string => {
    let name = base;
    for (let n = scriptIndex + 1; methods.has(name); n += 1) name = `${base}${n}`;
    methods.add(name);
    return name;
  };
  validated.scripts.forEach((script, scriptIndex) => {
    const scriptId = `scripts[${scriptIndex}]`;
    const procedures = script.procedures ?? [];
    const baseNames = procedureIdentifiers(procedures);
    const names = baseNames.map((base) => unique(camelCase(base), scriptIndex));
    const known = new Map(writer.procedureNames);
    procedures.forEach((item, index) => known.set(item.id, names[index]!));
    writer.procedureNames = known;
    procedures.forEach((procedure, procedureIndex) => {
      const procedureId = `${scriptId}/procedures[${procedureIndex}]`;
      const params = procedure.params ?? [];
      const identifiers = paramIdentifiers(params);
      writer.paramNames = new Map(params.map((item, k) => [item.id, identifiers[k]!]));
      const start = writer.text.length;
      writer.text += `${INDENT}void ${names[procedureIndex]}(${identifiers.map((id) => `double ${id}`).join(", ")}) {\n`;
      block(writer, procedureId, procedure.body, "body", 2);
      writer.text += `${INDENT}}\n`;
      addRange(writer, procedureId, start, writer.text.length);
      writer.paramNames = undefined;
    });
    const start = writer.text.length;
    writer.text += `${INDENT}void ${unique(handlerName(script.trigger), scriptIndex)}() {\n`;
    block(writer, scriptId, script.statements, "statements", 2);
    writer.text += `${INDENT}}\n`;
    addRange(writer, scriptId, start, writer.text.length);
  });
  writer.text += "}\n";
  return {
    projection: JAVA_PROJECTION,
    text: writer.text,
    mapping: writer.mapping as NodeTextMapping,
    diagnostics: writer.diagnostics,
    metadata: {
      structuralNodeIds: Object.keys(writer.mapping),
      supportApi: [...JAVA_SUPPORT_API],
      executable: false,
    },
  };
}

/** `my_square_2` becomes `mySquare2`, the way a Java method is named. */
function camelCase(snake: string): string {
  return snake.replace(/_([a-z0-9])/g, (_match, letter: string) => letter.toUpperCase());
}

export const javaProjection: LanguageProjection = {
  descriptor: JAVA_PROJECTION,
  project: projectJava,
};

export const javaLanguagePack: LanguagePack = {
  id: JAVA_PROJECTION.id,
  name: JAVA_PROJECTION.label,
  version: JAVA_PROJECTION.version,
  supportedCanonicalOperations: [
    "move",
    "goTo",
    "glideTo",
    "turn",
    "pointInDirection",
    "pointTowards",
    "bounceOnEdge",
    "goToLayer",
    "setEffect",
    "changeEffect",
    "clearEffects",
    "say",
    "think",
    "show",
    "hide",
    "setSize",
    "changeSize",
    "wait",
    "switchCostume",
    "switchBackdrop",
    "playSound",
    "stopSounds",
    "setVolume",
    "changeVolume",
    "broadcast",
    "setVariable",
    "changeVariable",
    "showVariable",
    "hideVariable",
    "listAdd",
    "listRemoveAt",
    "listInsertAt",
    "listReplaceAt",
    "penDown",
    "penUp",
    "setPenColor",
    "setPenSize",
    "clearPen",
    "callProcedure",
    "repeat",
    "repeatUntil",
    "if",
  ],
  projection: javaProjection,
  formatting: { indentation: INDENT, mapping: "canonical-node-ranges" },
  pedagogy: {
    recommendedStage: "advanced",
    notes: ["Display only; runtime uses the canonical program."],
  },
};
