import { describe, expect, it } from "vitest";
import type { ProjectProgram, Statement } from "@agorix/program-model";
import {
  PACKAGE_NAME,
  assertLanguageProjectionConformance,
  createLanguageProjectionRegistry,
  createUnsupportedNodeDiagnostic,
  type LanguageProjection,
  type LanguageProjectionDiagnostic,
  type LanguageProjectionResult,
  type TextRange,
} from "./index.js";

const PROGRAM: ProjectProgram = {
  schema: "agorix/program/v1",
  scripts: [
    {
      id: "main",
      trigger: { type: "onStart" },
      statements: [
        { type: "move", steps: 10 },
        { type: "turn", degrees: 90 },
      ],
    },
  ],
};

const UNSUPPORTED_PROGRAM = {
  schema: "agorix/program/v1",
  scripts: [
    {
      id: "main",
      trigger: { type: "onStart" },
      statements: [{ type: "wait", seconds: 1 }],
    },
  ],
} as unknown as ProjectProgram;

function append(
  parts: string[],
  mapping: Record<string, TextRange[]>,
  nodeId: string,
  text: string,
): void {
  const start = parts.join("").length;
  parts.push(text);
  mapping[nodeId] = [{ start, end: start + text.length }];
}

function createLineProjection(): LanguageProjection {
  return {
    descriptor: { id: "line-demo", version: "1", label: "Line Demo", family: "test" },
    project(program): LanguageProjectionResult {
      const parts: string[] = [];
      const mapping: Record<string, TextRange[]> = {};
      const diagnostics: LanguageProjectionDiagnostic[] = [];
      program.scripts.forEach((script, scriptIndex) => {
        append(parts, mapping, `scripts[${scriptIndex}]/trigger`, "start\n");
        script.statements.forEach((statement, statementIndex) => {
          const nodeId = `scripts[${scriptIndex}]/statements[${statementIndex}]`;
          switch (statement.type) {
            case "move":
              append(parts, mapping, nodeId, `move ${statement.steps}\n`);
              break;
            case "turn":
              append(parts, mapping, nodeId, `turn ${statement.degrees}\n`);
              break;
            default: {
              const unknown = statement as { type?: unknown };
              diagnostics.push(
                createUnsupportedNodeDiagnostic({
                  nodeId,
                  nodeType: String(unknown.type),
                  projectionId: "line-demo",
                }),
              );
            }
          }
        });
      });
      return {
        projection: { id: "line-demo", version: "1", label: "Line Demo", family: "test" },
        text: parts.join(""),
        mapping,
        diagnostics,
      };
    },
  };
}

function createSentenceProjection(): LanguageProjection {
  return {
    descriptor: { id: "sentence-demo", version: "1", label: "Sentence Demo", family: "test" },
    project(program): LanguageProjectionResult {
      const parts: string[] = [];
      const mapping: Record<string, TextRange[]> = {};
      const diagnostics: LanguageProjectionDiagnostic[] = [];
      program.scripts.forEach((script, scriptIndex) => {
        append(parts, mapping, `scripts[${scriptIndex}]/trigger`, "When the project starts: ");
        script.statements.forEach((statement: Statement, statementIndex) => {
          const nodeId = `scripts[${scriptIndex}]/statements[${statementIndex}]`;
          switch (statement.type) {
            case "move":
              append(parts, mapping, nodeId, `go forward ${statement.steps}. `);
              break;
            case "turn":
              append(parts, mapping, nodeId, `turn ${statement.degrees} degrees. `);
              break;
            default: {
              const unknown = statement as { type?: unknown };
              diagnostics.push(
                createUnsupportedNodeDiagnostic({
                  nodeId,
                  nodeType: String(unknown.type),
                  projectionId: "sentence-demo",
                }),
              );
            }
          }
        });
      });
      return {
        projection: { id: "sentence-demo", version: "1", label: "Sentence Demo", family: "test" },
        text: parts.join(""),
        mapping,
        diagnostics,
        metadata: { structuralNodeIds: Object.keys(mapping) },
      };
    },
  };
}

describe("language-projection contract", () => {
  it("exports a package identity", () => {
    expect(PACKAGE_NAME).toBe("@agorix/language-projection");
  });

  it("registers and discovers projections without UI coupling", () => {
    const line = createLineProjection();
    const sentence = createSentenceProjection();
    const registry = createLanguageProjectionRegistry([line, sentence]);

    expect(registry.list().map((descriptor) => descriptor.id)).toEqual([
      "line-demo",
      "sentence-demo",
    ]);
    expect(registry.require("line-demo")).toBe(line);
    expect(() => registry.require("missing-demo")).toThrow(/not registered/);
  });

  it("runs the same conformance helper against two independent projections", () => {
    const testCase = {
      name: "basic movement",
      program: PROGRAM,
      requiredNodeIds: [
        "scripts[0]/trigger",
        "scripts[0]/statements[0]",
        "scripts[0]/statements[1]",
      ],
      unsupportedProgram: UNSUPPORTED_PROGRAM,
      unsupportedNodeId: "scripts[0]/statements[0]",
    };

    assertLanguageProjectionConformance(createLineProjection(), testCase);
    assertLanguageProjectionConformance(createSentenceProjection(), testCase);
  });
});
