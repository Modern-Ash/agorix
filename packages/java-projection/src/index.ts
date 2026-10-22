import {
  createUnsupportedNodeDiagnostic,
  type LanguageProjection,
  type LanguageProjectionDiagnostic,
  type LanguageProjectionResult,
  type LanguagePack,
  type TextRange,
} from "@agorix/language-projection";
import { validateProgram, type ProjectProgram, type Statement } from "@agorix/program-model";

export const JAVA_PROJECTION = {
  id: "java",
  version: "1",
  label: "Java",
  family: "java",
} as const;

interface Writer {
  text: string;
  mapping: Record<string, TextRange[]>;
  diagnostics: LanguageProjectionDiagnostic[];
}

function mapped(writer: Writer, nodeId: string, line: string): void {
  const start = writer.text.length;
  writer.text += line;
  writer.mapping[nodeId] = [{ start, end: writer.text.length }];
}

function unsupported(writer: Writer, nodeId: string, type: string): void {
  writer.diagnostics.push(
    createUnsupportedNodeDiagnostic({ nodeId, nodeType: type, projectionId: JAVA_PROJECTION.id }),
  );
  writer.text += `    // ${type} is not available in this Java view.\n`;
}

function statement(writer: Writer, node: Statement, nodeId: string, depth: number): void {
  const indent = "    ".repeat(depth);
  switch (node.type) {
    case "move":
      mapped(writer, nodeId, `${indent}move(${node.steps});\n`);
      return;
    case "turn":
      mapped(writer, nodeId, `${indent}turn(${node.degrees});\n`);
      return;
    case "playSound":
      mapped(writer, nodeId, `${indent}playSound(${JSON.stringify(node.soundId)});\n`);
      return;
    case "stopSounds":
      mapped(writer, nodeId, `${indent}stopSounds();\n`);
      return;
    case "setVolume":
      mapped(writer, nodeId, `${indent}setVolume(${node.volume});\n`);
      return;
    case "changeVolume":
      mapped(writer, nodeId, `${indent}changeVolume(${node.delta});\n`);
      return;
    case "repeat": {
      const start = writer.text.length;
      writer.text += `${indent}for (int i${depth} = 0; i${depth} < ${node.count}; i${depth}++) {\n`;
      node.body.forEach((child, index) =>
        statement(writer, child, `${nodeId}/body[${index}]`, depth + 1),
      );
      writer.text += `${indent}}\n`;
      writer.mapping[nodeId] = [{ start, end: writer.text.length }];
      return;
    }
    default:
      unsupported(writer, nodeId, node.type);
  }
}

/** Display-only Java view. The canonical program remains the runtime authority. */
export function projectJava(program: ProjectProgram): LanguageProjectionResult {
  const validated = validateProgram(program);
  const writer: Writer = { text: "class AgorixProgram {\n", mapping: {}, diagnostics: [] };
  if ((validated.variables?.length ?? 0) > 0) {
    validated.variables?.forEach((variable) =>
      unsupported(writer, `variables/${variable.id}`, "variable"),
    );
  }
  validated.scripts.forEach((script, scriptIndex) => {
    const scriptId = `scripts[${scriptIndex}]`;
    if (script.trigger.type !== "onStart" && script.trigger.type !== "greenFlag") {
      unsupported(writer, `${scriptId}/trigger`, script.trigger.type);
      return;
    }
    const start = writer.text.length;
    writer.text += "    void onStart() {\n";
    script.statements.forEach((node, index) =>
      statement(writer, node, `${scriptId}/statements[${index}]`, 2),
    );
    writer.text += "    }\n";
    writer.mapping[scriptId] = [{ start, end: writer.text.length }];
  });
  writer.text += "}\n";
  return {
    projection: JAVA_PROJECTION,
    text: writer.text,
    mapping: writer.mapping,
    diagnostics: writer.diagnostics,
    metadata: {
      structuralNodeIds: Object.keys(writer.mapping),
      supportApi: ["move", "turn", "playSound", "stopSounds", "setVolume", "changeVolume"],
      executable: false,
    },
  };
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
    "turn",
    "repeat",
    "playSound",
    "stopSounds",
    "setVolume",
    "changeVolume",
  ],
  projection: javaProjection,
  formatting: { indentation: "    ", mapping: "canonical-node-ranges" },
  pedagogy: {
    recommendedStage: "advanced",
    notes: ["Display only; runtime uses the canonical program."],
  },
};
