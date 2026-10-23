import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import { projectProgram } from "./project.js";

// Issue #467
const program: ProjectProgram = {
  schema: SCHEMA_VERSION,
  variables: [{ id: "r", name: "r", initialValue: 0, visible: false }],
  scripts: [
    {
      id: "main",
      trigger: { type: "onStart" },
      statements: [
        {
          type: "setVariable",
          variableId: "r",
          value: {
            type: "randomInteger",
            min: { type: "numericLiteral", value: 1 },
            max: { type: "numericLiteral", value: 6 },
          },
        },
      ],
    },
  ],
};

describe("randomInteger projection (issue #467)", () => {
  it("projects as a whole-number random", () => {
    expect(projectProgram(program).code).toContain("randomInteger(1, 6)");
  });
});
