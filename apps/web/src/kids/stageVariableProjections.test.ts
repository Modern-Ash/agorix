import { describe, expect, it } from "vitest";
import { projectAgorixCode } from "@agorix/agorix-code";
import { projectProgram } from "@agorix/code-generator";
import { projectJava } from "@agorix/java-projection";
import { projectPython } from "@agorix/python-projection";
import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";

const scene: ProjectProgram = {
  schema: SCHEMA_VERSION,
  variables: [{ id: "score", name: "Score", initialValue: 4, visible: true, scope: "stage" }],
  textVariables: [{ id: "word", name: "Word", initialValue: "hi", visible: true, scope: "stage" }],
  lists: [{ id: "items", name: "Items", initialItems: ["a"], visible: true, scope: "stage" }],
  scripts: [
    {
      id: "main",
      trigger: { type: "greenFlag" },
      statements: [
        {
          type: "changeVariable",
          variableId: "score",
          delta: { type: "numericLiteral", value: 1 },
        },
      ],
    },
  ],
};

describe("Stage variable code views", () => {
  it("names shared Stage ownership in every language view", () => {
    expect(projectAgorixCode(scene).text).toContain('stage variable "Score" = 4');
    expect(projectPython(scene).text).toContain("# Stage variable shared by all characters");
    expect(projectProgram(scene).code).toContain("// Stage variable shared by all characters");
    expect(projectJava(scene).text).toContain("// Stage variable shared by all characters");
    expect(projectAgorixCode(scene).text).toContain('stage text "Word" = "hi"');
    expect(projectPython(scene).text).toContain("# Stage word shared by all characters");
    expect(projectProgram(scene).code).toContain("// Stage word shared by all characters");
    expect(projectJava(scene).text).toContain("// Stage word shared by all characters");
    expect(projectAgorixCode(scene).text).toContain('stage list "Items" = "a"');
    expect(projectPython(scene).text).toContain("# Stage list shared by all characters");
    expect(projectProgram(scene).code).toContain("// Stage list shared by all characters");
    expect(projectJava(scene).text).toContain("// Stage list shared by all characters");
  });
});
