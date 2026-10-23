import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import { projectProgram } from "./project.js";
// Issue #463: else is projected; without else the text is unchanged.
const withElse: ProjectProgram = {
  schema: SCHEMA_VERSION,
  scripts: [
    {
      id: "main",
      trigger: { type: "onStart" },
      statements: [
        {
          type: "if",
          condition: { type: "touchingGoal" },
          then: [{ type: "move", steps: 1 }],
          else: [{ type: "turn", degrees: 90 }],
        },
      ],
    },
  ],
};
const withoutElse: ProjectProgram = {
  ...withElse,
  scripts: [
    {
      ...withElse.scripts[0]!,
      statements: [
        { type: "if", condition: { type: "touchingGoal" }, then: [{ type: "move", steps: 1 }] },
      ],
    },
  ],
};

describe("if / else projection (issue #463)", () => {
  it("TypeScript", () => {
    const { code, mapping } = projectProgram(withElse);
    expect(code).toMatch(/\} else \{/);
    expect(Object.keys(mapping)).toContain("scripts[0]/statements[0]/else[0]");
    expect(projectProgram(withoutElse).code).not.toContain("else");
  });
});
