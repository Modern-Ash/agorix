import {
  createUnsupportedNodeDiagnostic,
  type LanguagePack,
  type LanguageProjection,
  type LanguageProjectionDiagnostic,
  type LanguageProjectionResult,
  type TextRange,
} from "@agorix/language-projection";
import {
  validateProgram,
  type Expression,
  type ProjectProgram,
  type Statement,
} from "@agorix/program-model";

export const LUA_PROJECTION = {
  id: "lua",
  version: "spike-1",
  label: "Lua",
  family: "lua",
} as const;

interface Writer {
  text: string;
  mapping: Record<string, TextRange[]>;
  diagnostics: LanguageProjectionDiagnostic[];
}

export function projectLua(program: ProjectProgram): LanguageProjectionResult {
  const validated = validateProgram(program);
  const writer: Writer = { text: "", mapping: {}, diagnostics: [] };
  validated.scripts.forEach((script, scriptIndex) => {
    const scriptId = "scripts[" + scriptIndex + "]";
    const start = writer.text.length;
    writer.text += "function on_start()\n";
    script.statements.forEach((statement, index) =>
      writeStatement(writer, statement, scriptId + "/statements[" + index + "]", 1),
    );
    writer.text += "end\n";
    addRange(writer, scriptId, start, writer.text.length);
  });
  return {
    projection: LUA_PROJECTION,
    text: writer.text,
    mapping: writer.mapping,
    diagnostics: writer.diagnostics,
    metadata: { executable: false },
  };
}

export const luaProjection: LanguageProjection = {
  descriptor: LUA_PROJECTION,
  project: projectLua,
};

export const luaLanguagePack: LanguagePack = {
  id: "lua",
  name: "Lua projection spike",
  version: "spike-1",
  supportedCanonicalOperations: [
    "onStart",
    "greenFlag",
    "move",
    "turn",
    "repeat",
    "if",
    "touchingGoal",
    "booleanLiteral",
    "numericLiteral",
  ],
  projection: luaProjection,
  formatting: { indentation: "  ", mapping: "canonical-node-ranges" },
  pedagogy: { notes: ["Validation pack only; not a default learner language."] },
};

function writeStatement(writer: Writer, statement: Statement, nodeId: string, depth: number): void {
  const pad = "  ".repeat(depth);
  const start = writer.text.length;
  switch (statement.type) {
    case "move":
      writer.text += pad + "move(" + statement.steps + ")\n";
      break;
    case "turn":
      writer.text += pad + "turn(" + statement.degrees + ")\n";
      break;
    case "repeat":
      writer.text += pad + "for _ = 1, " + statement.count + " do\n";
      statement.body.forEach((child, index) =>
        writeStatement(writer, child, nodeId + "/body[" + index + "]", depth + 1),
      );
      writer.text += pad + "end\n";
      break;
    case "if":
      writer.text +=
        pad + "if " + expression(writer, statement.condition, nodeId + "/condition") + " then\n";
      statement.then.forEach((child, index) =>
        writeStatement(writer, child, nodeId + "/then[" + index + "]", depth + 1),
      );
      writer.text += pad + "end\n";
      break;
    default: {
      const unknown = statement as { type?: unknown };
      writer.diagnostics.push(
        createUnsupportedNodeDiagnostic({
          nodeId,
          nodeType: String(unknown.type),
          projectionId: "lua",
        }),
      );
    }
  }
  addRange(writer, nodeId, start, writer.text.length);
}

function expression(writer: Writer, value: Expression, nodeId: string): string {
  switch (value.type) {
    case "touchingGoal":
      return "touching_goal()";
    case "booleanLiteral":
      return value.value ? "true" : "false";
    case "numericLiteral":
      return String(value.value);
    default: {
      const unknown = value as { type?: unknown };
      writer.diagnostics.push(
        createUnsupportedNodeDiagnostic({
          nodeId,
          nodeType: String(unknown.type),
          projectionId: "lua",
        }),
      );
      return "false";
    }
  }
}

function addRange(writer: Writer, nodeId: string, start: number, end: number): void {
  (writer.mapping[nodeId] ??= []).push({ start, end });
}
