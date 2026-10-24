import {
  createUnsupportedNodeDiagnostic,
  type LanguageProjection,
  type LanguageProjectionDiagnostic,
  type LanguageProjectionResult,
  type NodeTextMapping,
  type TextRange,
} from "@agorix/language-projection";
import {
  validateProgram,
  type Expression,
  type ProjectProgram,
  type Statement,
  type Trigger,
} from "@agorix/program-model";

export const PYTHON_PROJECTION = {
  id: "python",
  version: "1",
  label: "Python",
  family: "python",
} as const;

interface Writer {
  text: string;
  mapping: Record<string, TextRange[]>;
  diagnostics: LanguageProjectionDiagnostic[];
  variableNames: ReadonlyMap<string, string>;
  listNames: ReadonlyMap<string, string>;
}

export function projectPython(program: ProjectProgram): LanguageProjectionResult {
  const validated = validateProgram(program);
  const writer: Writer = {
    text: "",
    mapping: {},
    diagnostics: [],
    variableNames: variableNamesFor(validated.variables),
    listNames: variableNamesFor(
      validated.lists,
      new Set(variableNamesFor(validated.variables).values()),
    ),
  };
  for (const variable of validated.variables ?? []) {
    writeMapped(
      writer,
      "variables/" + variable.id,
      variableIdentifier(writer, variable.id) + " = " + formatNumber(variable.initialValue) + "\n",
    );
    if (variable.visible) {
      writeMapped(
        writer,
        "variables/" + variable.id,
        "show_variable(" + JSON.stringify(variableIdentifier(writer, variable.id)) + ")\n",
      );
    }
  }
  for (const list of validated.lists ?? []) {
    writeMapped(
      writer,
      "lists/" + list.id,
      listIdentifier(writer, list.id) +
        " = [" +
        list.initialItems.map(formatNumber).join(", ") +
        "]\n",
    );
    if (list.visible) {
      writeMapped(
        writer,
        "lists/" + list.id,
        "show_list(" + JSON.stringify(listIdentifier(writer, list.id)) + ")\n",
      );
    }
  }
  if ((validated.variables?.length ?? 0) > 0 || (validated.lists?.length ?? 0) > 0) {
    writer.text += "\n";
  }
  validated.scripts.forEach((script, scriptIndex) => {
    const scriptId = "scripts[" + scriptIndex + "]";
    writeMapped(writer, scriptId, triggerText(script.trigger));
    if (script.statements.length === 0) {
      writer.text += "    pass\n";
    } else {
      const globals = assignedVariableIdentifiers(writer, script.statements);
      if (globals.length > 0) {
        writer.text += "    global " + globals.join(", ") + "\n";
      }
      script.statements.forEach((statement, index) =>
        writeStatement(writer, statement, scriptId + "/statements[" + index + "]", 1),
      );
    }
  });
  return {
    projection: PYTHON_PROJECTION,
    text: writer.text,
    mapping: writer.mapping as NodeTextMapping,
    diagnostics: writer.diagnostics,
    metadata: {
      structuralNodeIds: Object.keys(writer.mapping),
      supportApi: [
        "move",
        "go_to",
        "turn",
        "touching_goal",
        "say",
        "think",
        "show",
        "hide",
        "set_size",
        "switch_costume",
        "switch_backdrop",
        "play_sound",
        "stop_sounds",
        "set_volume",
        "change_volume",
        "show_variable",
        "hide_variable",
        "random_number",
        "random_integer",
        "list_add",
        "list_remove_at",
        "list_item",
        "show_list",
        "wait",
      ],
      executable: false,
    },
  };
}

function triggerText(trigger: Trigger): string {
  switch (trigger.type) {
    case "greenFlag":
    case "onStart":
      return "def on_start():\n";
    case "onActorClicked":
      return "def on_actor_clicked():\n";
    case "onKeyPressed":
      return `def on_key_pressed_${safeEventName(trigger.key)}():\n`;
    case "onMessage":
      return `def on_message_${safeEventName(trigger.message)}():\n`;
  }
}

function safeEventName(value: string): string {
  return value.replace(/[^a-zA-Z0-9_]/g, "_").replace(/^([^a-zA-Z_])/, "_$1");
}

export const pythonProjection: LanguageProjection = {
  descriptor: PYTHON_PROJECTION,
  project: projectPython,
};

function writeStatement(writer: Writer, statement: Statement, nodeId: string, depth: number): void {
  const indent = "    ".repeat(depth);
  switch (statement.type) {
    case "move":
      writeMapped(writer, nodeId, indent + "move(" + formatNumber(statement.steps) + ")\n");
      return;
    case "goTo":
      writeMapped(
        writer,
        nodeId,
        indent + "go_to(" + formatNumber(statement.x) + ", " + formatNumber(statement.y) + ")\n",
      );
      return;
    case "turn":
      writeMapped(writer, nodeId, indent + "turn(" + formatNumber(statement.degrees) + ")\n");
      return;
    case "say":
      writeMapped(writer, nodeId, indent + "say(" + JSON.stringify(statement.text) + ")\n");
      return;
    case "think":
      writeMapped(writer, nodeId, indent + "think(" + JSON.stringify(statement.text) + ")\n");
      return;
    case "show":
      writeMapped(writer, nodeId, indent + "show()\n");
      return;
    case "hide":
      writeMapped(writer, nodeId, indent + "hide()\n");
      return;
    case "listAdd":
      writeMapped(
        writer,
        nodeId,
        indent +
          "list_add(" +
          listIdentifier(writer, statement.listId) +
          ", " +
          expressionText(writer, statement.value, nodeId + "/value") +
          ")\n",
      );
      return;
    case "listRemoveAt":
      writeMapped(
        writer,
        nodeId,
        indent +
          "list_remove_at(" +
          listIdentifier(writer, statement.listId) +
          ", " +
          expressionText(writer, statement.index, nodeId + "/index") +
          ")\n",
      );
      return;
    case "listInsertAt":
    case "listReplaceAt":
      writeMapped(
        writer,
        nodeId,
        indent +
          (statement.type === "listInsertAt" ? "list_insert_at(" : "list_replace_at(") +
          listIdentifier(writer, statement.listId) +
          ", " +
          expressionText(writer, statement.index, nodeId + "/index") +
          ", " +
          expressionText(writer, statement.value, nodeId + "/value") +
          ")\n",
      );
      return;
    case "wait":
      writeMapped(writer, nodeId, indent + "wait(" + formatNumber(statement.seconds) + ")\n");
      return;
    case "setSize":
      writeMapped(writer, nodeId, indent + "set_size(" + formatNumber(statement.size) + ")\n");
      return;
    case "switchCostume":
      writeMapped(
        writer,
        nodeId,
        indent + "switch_costume(" + JSON.stringify(statement.costumeId) + ")\n",
      );
      return;
    case "switchBackdrop":
      writeMapped(
        writer,
        nodeId,
        indent + "switch_backdrop(" + JSON.stringify(statement.backdropId) + ")\n",
      );
      return;
    case "playSound":
      writeMapped(
        writer,
        nodeId,
        indent + "play_sound(" + JSON.stringify(statement.soundId) + ")\n",
      );
      return;
    case "stopSounds":
      writeMapped(writer, nodeId, indent + "stop_sounds()\n");
      return;
    case "setVolume":
      writeMapped(writer, nodeId, indent + "set_volume(" + formatNumber(statement.volume) + ")\n");
      return;
    case "changeVolume":
      writeMapped(
        writer,
        nodeId,
        indent + "change_volume(" + formatNumber(statement.delta) + ")\n",
      );
      return;
    case "setVariable":
      writeMapped(
        writer,
        nodeId,
        indent +
          variableIdentifier(writer, statement.variableId) +
          " = " +
          expressionText(writer, statement.value, nodeId + "/value") +
          "\n",
      );
      return;
    case "changeVariable":
      writeMapped(
        writer,
        nodeId,
        indent +
          variableIdentifier(writer, statement.variableId) +
          " += " +
          expressionText(writer, statement.delta, nodeId + "/delta") +
          "\n",
      );
      return;
    case "showVariable":
      writeMapped(
        writer,
        nodeId,
        indent +
          "show_variable(" +
          JSON.stringify(variableIdentifier(writer, statement.variableId)) +
          ")\n",
      );
      return;
    case "hideVariable":
      writeMapped(
        writer,
        nodeId,
        indent +
          "hide_variable(" +
          JSON.stringify(variableIdentifier(writer, statement.variableId)) +
          ")\n",
      );
      return;
    case "repeat": {
      const start = writer.text.length;
      writer.text += indent + "for _ in range(" + formatNumber(statement.count) + "):\n";
      if (statement.body.length === 0) {
        writer.text += indent + "    pass\n";
      } else {
        statement.body.forEach((child, index) =>
          writeStatement(writer, child, nodeId + "/body[" + index + "]", depth + 1),
        );
      }
      addRange(writer, nodeId, start, writer.text.length);
      return;
    }
    case "if": {
      const start = writer.text.length;
      writer.text +=
        indent + "if " + expressionText(writer, statement.condition, nodeId + "/condition") + ":\n";
      if (statement.then.length === 0) {
        writer.text += indent + "    pass\n";
      } else {
        statement.then.forEach((child, index) =>
          writeStatement(writer, child, nodeId + "/then[" + index + "]", depth + 1),
        );
      }
      if (statement.else !== undefined) {
        writer.text += indent + "else:\n";
        if (statement.else.length === 0) {
          writer.text += indent + "    pass\n";
        } else {
          statement.else.forEach((child, index) =>
            writeStatement(writer, child, nodeId + "/else[" + index + "]", depth + 1),
          );
        }
      }
      addRange(writer, nodeId, start, writer.text.length);
      return;
    }
    default: {
      const unknown = statement as { type?: unknown };
      writer.diagnostics.push(
        createUnsupportedNodeDiagnostic({
          nodeId,
          nodeType: String(unknown.type),
          projectionId: PYTHON_PROJECTION.id,
        }),
      );
    }
  }
}

function expressionText(writer: Writer, expression: Expression, nodeId: string): string {
  switch (expression.type) {
    case "touchingGoal":
      return "touching_goal()";
    case "booleanLiteral":
      return expression.value ? "True" : "False";
    case "numericLiteral":
      return formatNumber(expression.value);
    case "variable":
      return variableIdentifier(writer, expression.variableId);
    case "add":
      return (
        "(" +
        expressionText(writer, expression.left, nodeId + "/left") +
        " + " +
        expressionText(writer, expression.right, nodeId + "/right") +
        ")"
      );
    case "subtract":
      return (
        "(" +
        expressionText(writer, expression.left, nodeId + "/left") +
        " - " +
        expressionText(writer, expression.right, nodeId + "/right") +
        ")"
      );
    case "multiply":
      return (
        "(" +
        expressionText(writer, expression.left, nodeId + "/left") +
        " * " +
        expressionText(writer, expression.right, nodeId + "/right") +
        ")"
      );
    case "divide":
      return (
        "(" +
        expressionText(writer, expression.left, nodeId + "/left") +
        " / " +
        expressionText(writer, expression.right, nodeId + "/right") +
        ")"
      );
    case "lessThan":
      return (
        "(" +
        expressionText(writer, expression.left, nodeId + "/left") +
        " < " +
        expressionText(writer, expression.right, nodeId + "/right") +
        ")"
      );
    case "greaterThan":
      return (
        "(" +
        expressionText(writer, expression.left, nodeId + "/left") +
        " > " +
        expressionText(writer, expression.right, nodeId + "/right") +
        ")"
      );
    case "lessOrEqual":
      return (
        "(" +
        expressionText(writer, expression.left, nodeId + "/left") +
        " <= " +
        expressionText(writer, expression.right, nodeId + "/right") +
        ")"
      );
    case "greaterOrEqual":
      return (
        "(" +
        expressionText(writer, expression.left, nodeId + "/left") +
        " >= " +
        expressionText(writer, expression.right, nodeId + "/right") +
        ")"
      );
    case "equals":
      return (
        "(" +
        expressionText(writer, expression.left, nodeId + "/left") +
        " == " +
        expressionText(writer, expression.right, nodeId + "/right") +
        ")"
      );
    case "and":
      return (
        "(" +
        expressionText(writer, expression.left, nodeId + "/left") +
        " and " +
        expressionText(writer, expression.right, nodeId + "/right") +
        ")"
      );
    case "or":
      return (
        "(" +
        expressionText(writer, expression.left, nodeId + "/left") +
        " or " +
        expressionText(writer, expression.right, nodeId + "/right") +
        ")"
      );
    case "not":
      return "(not " + expressionText(writer, expression.value, nodeId + "/value") + ")";
    case "listItem":
      return (
        "list_item(" +
        listIdentifier(writer, expression.listId) +
        ", " +
        expressionText(writer, expression.index, nodeId + "/index") +
        ")"
      );
    case "listLength":
      return "len(" + listIdentifier(writer, expression.listId) + ")";
    case "randomInteger":
      return (
        "random_integer(" +
        expressionText(writer, expression.min, nodeId + "/min") +
        ", " +
        expressionText(writer, expression.max, nodeId + "/max") +
        ")"
      );
    case "random":
      return (
        "random_number(" +
        expressionText(writer, expression.min, nodeId + "/min") +
        ", " +
        expressionText(writer, expression.max, nodeId + "/max") +
        ")"
      );
    default: {
      const unknown = expression as { type?: unknown };
      writer.diagnostics.push(
        createUnsupportedNodeDiagnostic({
          nodeId,
          nodeType: String(unknown.type),
          projectionId: PYTHON_PROJECTION.id,
        }),
      );
      return "False";
    }
  }
}

function variableIdentifier(writer: Writer, variableId: string): string {
  return writer.variableNames.get(variableId) ?? variableId;
}

function assignedVariableIdentifiers(
  writer: Writer,
  statements: readonly Statement[],
): readonly string[] {
  const identifiers: string[] = [];
  const seen = new Set<string>();
  const visit = (list: readonly Statement[]): void => {
    for (const statement of list) {
      if (statement.type === "setVariable" || statement.type === "changeVariable") {
        if (!writer.variableNames.has(statement.variableId)) {
          continue;
        }
        const identifier = variableIdentifier(writer, statement.variableId);
        if (!seen.has(identifier)) {
          seen.add(identifier);
          identifiers.push(identifier);
        }
      } else if (statement.type === "repeat") {
        visit(statement.body);
      } else if (statement.type === "if") {
        visit(statement.then);
        if (statement.else !== undefined) visit(statement.else);
      }
    }
  };
  visit(statements);
  return identifiers;
}

const PYTHON_RESERVED_WORDS: ReadonlySet<string> = new Set([
  "False",
  "None",
  "True",
  "and",
  "as",
  "assert",
  "async",
  "await",
  "break",
  "class",
  "continue",
  "def",
  "del",
  "elif",
  "else",
  "except",
  "finally",
  "for",
  "from",
  "global",
  "if",
  "import",
  "in",
  "is",
  "lambda",
  "nonlocal",
  "not",
  "or",
  "pass",
  "raise",
  "return",
  "try",
  "while",
  "with",
  "yield",
]);

const PYTHON_PROJECTION_IDENTIFIERS: ReadonlySet<string> = new Set([
  "move",
  "go_to",
  "turn",
  "touching_goal",
  "say",
  "think",
  "show",
  "hide",
  "set_size",
  "switch_costume",
  "switch_backdrop",
  "show_variable",
  "hide_variable",
  "random_number",
  "random_integer",
  "list_add",
  "list_remove_at",
  "list_item",
  "show_list",
  "wait",
  "range",
  "print",
  "len",
  "str",
  "int",
  "float",
  "bool",
  "abs",
  "max",
  "min",
  "sum",
  "round",
]);

function safeIdentifier(value: string, fallback: string): string {
  const words = value.match(/[A-Za-z0-9]+/g) ?? [];
  const candidate = words
    .map((word, index) => {
      const lower = word.toLowerCase();
      return index === 0 ? lower : lower[0]?.toUpperCase() + lower.slice(1);
    })
    .join("");
  const identifier = candidate.length > 0 ? candidate : fallback;
  const valid = /^[A-Za-z_]/.test(identifier) ? identifier : `v${identifier}`;
  const forbidden = PYTHON_RESERVED_WORDS.has(valid) || PYTHON_PROJECTION_IDENTIFIERS.has(valid);
  return forbidden ? `${valid}_` : valid;
}

function listIdentifier(writer: Writer, listId: string): string {
  return writer.listNames.get(listId) ?? safeIdentifier(listId, "items");
}

function variableNamesFor(
  variables: readonly { id: string; name: string }[] | undefined,
  taken: ReadonlySet<string> = new Set(),
): ReadonlyMap<string, string> {
  const names = new Map<string, string>();
  const used = new Set<string>(taken);
  for (const variable of variables ?? []) {
    const base = safeIdentifier(variable.name, safeIdentifier(variable.id, "value"));
    let name = base;
    let suffix = 2;
    while (used.has(name)) {
      name = `${base}${suffix}`;
      suffix += 1;
    }
    used.add(name);
    names.set(variable.id, name);
  }
  return names;
}

function writeMapped(writer: Writer, nodeId: string, text: string): void {
  const start = writer.text.length;
  writer.text += text;
  addRange(writer, nodeId, start, writer.text.length);
}

function addRange(writer: Writer, nodeId: string, start: number, end: number): void {
  (writer.mapping[nodeId] ??= []).push({ start, end });
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(6)));
}
