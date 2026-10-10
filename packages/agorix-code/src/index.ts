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

export const AGORIX_CODE_PROJECTION = {
  id: "agorix-code",
  version: "1",
  label: "Agorix Code",
  family: "educational",
} as const;

interface Writer {
  text: string;
  mapping: Record<string, TextRange[]>;
  diagnostics: LanguageProjectionDiagnostic[];
  variableLabels: ReadonlyMap<string, string>;
}

export function projectAgorixCode(program: ProjectProgram): LanguageProjectionResult {
  const validated = validateProgram(program);
  const writer: Writer = {
    text: "",
    mapping: {},
    diagnostics: [],
    variableLabels: variableDisplayNamesFor(validated.variables),
  };
  for (const variable of validated.variables ?? []) {
    writeMapped(
      writer,
      "variables/" + variable.id,
      "variable " +
        variableName(writer, variable.id) +
        " = " +
        formatNumber(variable.initialValue) +
        "\n",
    );
    if (variable.visible) {
      writeMapped(
        writer,
        "variables/" + variable.id,
        "show " + variableName(writer, variable.id) + "\n",
      );
    }
  }
  if ((validated.variables?.length ?? 0) > 0) {
    writer.text += "\n";
  }
  validated.scripts.forEach((script, scriptIndex) => {
    const scriptId = "scripts[" + scriptIndex + "]";
    writeMapped(writer, scriptId, "when start\n");
    script.statements.forEach((statement, index) =>
      writeStatement(writer, statement, scriptId + "/statements[" + index + "]", 1),
    );
  });
  return {
    projection: AGORIX_CODE_PROJECTION,
    text: writer.text,
    mapping: writer.mapping as NodeTextMapping,
    diagnostics: writer.diagnostics,
    metadata: { structuralNodeIds: Object.keys(writer.mapping) },
  };
}

export const agorixCodeProjection: LanguageProjection = {
  descriptor: AGORIX_CODE_PROJECTION,
  project: projectAgorixCode,
};

function writeStatement(writer: Writer, statement: Statement, nodeId: string, depth: number): void {
  const indent = "  ".repeat(depth);
  switch (statement.type) {
    case "move":
      writeMapped(writer, nodeId, indent + "move " + formatNumber(statement.steps) + "\n");
      return;
    case "turn":
      writeMapped(writer, nodeId, indent + "turn " + formatNumber(statement.degrees) + "\n");
      return;
    case "say":
      writeMapped(writer, nodeId, indent + "say " + JSON.stringify(statement.text) + "\n");
      return;
    case "think":
      writeMapped(writer, nodeId, indent + "think " + JSON.stringify(statement.text) + "\n");
      return;
    case "show":
      writeMapped(writer, nodeId, indent + "show\n");
      return;
    case "hide":
      writeMapped(writer, nodeId, indent + "hide\n");
      return;
    case "setSize":
      writeMapped(writer, nodeId, indent + "set size to " + formatNumber(statement.size) + "\n");
      return;
    case "switchCostume":
      writeMapped(
        writer,
        nodeId,
        indent + "switch costume to " + JSON.stringify(statement.costumeId) + "\n",
      );
      return;
    case "switchBackdrop":
      writeMapped(
        writer,
        nodeId,
        indent + "switch backdrop to " + JSON.stringify(statement.backdropId) + "\n",
      );
      return;
    case "setVariable":
      writeMapped(
        writer,
        nodeId,
        indent +
          "set " +
          variableName(writer, statement.variableId) +
          " to " +
          expressionText(writer, statement.value, nodeId + "/value") +
          "\n",
      );
      return;
    case "changeVariable":
      writeMapped(
        writer,
        nodeId,
        indent +
          "change " +
          variableName(writer, statement.variableId) +
          " by " +
          expressionText(writer, statement.delta, nodeId + "/delta") +
          "\n",
      );
      return;
    case "showVariable":
      writeMapped(
        writer,
        nodeId,
        indent + "show " + variableName(writer, statement.variableId) + "\n",
      );
      return;
    case "hideVariable":
      writeMapped(
        writer,
        nodeId,
        indent + "hide " + variableName(writer, statement.variableId) + "\n",
      );
      return;
    case "repeat": {
      const start = writer.text.length;
      writer.text += indent + "repeat " + formatNumber(statement.count) + " times\n";
      statement.body.forEach((child, index) =>
        writeStatement(writer, child, nodeId + "/body[" + index + "]", depth + 1),
      );
      addRange(writer, nodeId, start, writer.text.length);
      return;
    }
    case "if": {
      const start = writer.text.length;
      writer.text +=
        indent + "if " + expressionText(writer, statement.condition, nodeId + "/condition") + "\n";
      statement.then.forEach((child, index) =>
        writeStatement(writer, child, nodeId + "/then[" + index + "]", depth + 1),
      );
      addRange(writer, nodeId, start, writer.text.length);
      return;
    }
    default: {
      const unknown = statement as { type?: unknown };
      writer.diagnostics.push(
        createUnsupportedNodeDiagnostic({
          nodeId,
          nodeType: String(unknown.type),
          projectionId: AGORIX_CODE_PROJECTION.id,
        }),
      );
    }
  }
}

function expressionText(writer: Writer, expression: Expression, nodeId: string): string {
  switch (expression.type) {
    case "touchingGoal":
      return "touching goal";
    case "booleanLiteral":
      return expression.value ? "true" : "false";
    case "numericLiteral":
      return formatNumber(expression.value);
    case "variable":
      return variableName(writer, expression.variableId);
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
        " = " +
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
      return "not " + expressionText(writer, expression.value, nodeId + "/value");
    case "random":
      return (
        "random " +
        expressionText(writer, expression.min, nodeId + "/min") +
        " to " +
        expressionText(writer, expression.max, nodeId + "/max")
      );
    default: {
      const unknown = expression as { type?: unknown };
      writer.diagnostics.push(
        createUnsupportedNodeDiagnostic({
          nodeId,
          nodeType: String(unknown.type),
          projectionId: AGORIX_CODE_PROJECTION.id,
        }),
      );
      return "<?>";
    }
  }
}

function variableName(writer: Writer, variableId: string): string {
  return JSON.stringify(writer.variableLabels.get(variableId) ?? variableId);
}

function variableDisplayNamesFor(
  variables: readonly { id: string; name: string }[] | undefined,
): ReadonlyMap<string, string> {
  const names = new Map<string, string>();
  const used = new Set<string>();
  for (const variable of variables ?? []) {
    let name = variable.name;
    let suffix = 2;
    while (used.has(name)) {
      name = `${variable.name}${suffix}`;
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
