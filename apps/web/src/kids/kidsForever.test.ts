import { describe, expect, it } from "vitest";
import { projectAgorixCode } from "@agorix/agorix-code";
import { projectProgram } from "@agorix/code-generator";
import { projectPython } from "@agorix/python-projection";
import { projectJava } from "@agorix/java-projection";
import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";

const program: ProjectProgram = {
  schema: SCHEMA_VERSION,
  scripts: [
    {
      id: "main",
      trigger: { type: "onStart" },
      statements: [{ type: "forever", body: [{ type: "move", steps: 1 }] }],
    },
  ],
};

describe("forever projections", () => {
  it("shows the canonical body and budget boundary in every code view", () => {
    expect(projectAgorixCode(program).text).toMatch(
      /forever \(bounded by run budget\)[\s\S]*move 1/,
    );
    expect(projectProgram(program).code).toMatch(
      /forever\(\(\) => \{ \/\/ bounded by runtime budgets[\s\S]*sprite\.move\(1\)/,
    );
    expect(projectPython(program).text).toMatch(
      /while True: {2}# bounded by runtime budgets[\s\S]*move\(1\)/,
    );
    expect(projectJava(program).text).toMatch(
      /while \(true\) \{ \/\/ bounded by runtime budgets[\s\S]*move\(1\)/,
    );
  });
});
