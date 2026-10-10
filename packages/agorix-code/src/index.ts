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
}

export function projectAgorixCode(program: ProjectProgram): LanguageProjectionResult {
  const validated = validateProgram(program);
  const writer: Writer = { text: "", mapping: {}, diagnostics: [] };
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
