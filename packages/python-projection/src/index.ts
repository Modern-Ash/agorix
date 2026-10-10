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
}

export function projectPython(program: ProjectProgram): LanguageProjectionResult {
  const validated = validateProgram(program);
  const writer: Writer = { text: "", mapping: {}, diagnostics: [] };
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
