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
  variableLabels: ReadonlyMap<string, string>;
}

export function projectPython(program: ProjectProgram): LanguageProjectionResult {
  const validated = validateProgram(program);
  const writer: Writer = {
    text: "",
    mapping: {},
    diagnostics: [],
    variableNames: variableNamesFor(validated.variables),
    variableLabels: new Map(
      (validated.variables ?? []).map((variable) => [variable.id, variable.name]),
    ),
  };
  for (const variable of validated.variables ?? []) {
    writeMapped(
      writer,
      "variables/" + variable.id,
      variableIdentifier(writer, variable.id) + " = " + formatNumber(variable.initialValue) + "\n",
    );
  }
  if ((validated.variables?.length ?? 0) > 0) {
    writer.text += "\n";
  }
  validated.scripts.forEach((script, scriptIndex) => {
    const scriptId = "scripts[" + scriptIndex + "]";
    writeMapped(writer, scriptId, "def on_start():\n");
    if (script.statements.length === 0) {
      writer.text += "    pass\n";
    } else {
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
        "turn",
        "touching_goal",
        "say",
        "think",
        "show",
        "hide",
        "set_size",
        "switch_costume",
        "switch_backdrop",
        "set_variable",
        "change_variable",
        "show_variable",
        "hide_variable",
        "random_number",
      ],
      executable: false,
    },
  };
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
    case "setVariable":
      writeMapped(
        writer,
        nodeId,
        indent +
          "set_variable(" +
          JSON.stringify(variableLabel(writer, statement.variableId)) +
          ", " +
          expressionText(writer, statement.value, nodeId + "/value") +
          ")\n",
      );
      return;
    case "changeVariable":
      writeMapped(
        writer,
        nodeId,
        indent +
          "change_variable(" +
          JSON.stringify(variableLabel(writer, statement.variableId)) +
          ", " +
          expressionText(writer, statement.delta, nodeId + "/delta") +
          ")\n",
      );
      return;
    case "showVariable":
      writeMapped(
        writer,
        nodeId,
        indent +
          "show_variable(" +
          JSON.stringify(variableLabel(writer, statement.variableId)) +
          ")\n",
      );
      return;
    case "hideVariable":
      writeMapped(
        writer,
        nodeId,
        indent +
          "hide_variable(" +
          JSON.stringify(variableLabel(writer, statement.variableId)) +
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

function variableLabel(writer: Writer, variableId: string): string {
  return writer.variableLabels.get(variableId) ?? variableId;
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
  return PYTHON_RESERVED_WORDS.has(valid) ? `${valid}_` : valid;
}

function variableNamesFor(
  variables: readonly { id: string; name: string }[] | undefined,
): ReadonlyMap<string, string> {
  const names = new Map<string, string>();
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
