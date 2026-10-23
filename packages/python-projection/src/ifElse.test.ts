import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import { projectPython } from "./index.js";
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
  it("Python", () => {
    const text = projectPython(withElse).text;
    expect(text).toMatch(/if .*:\n\s+move\(.*\)\n\s+else:\n\s+turn\(/s);
    expect(projectPython(withoutElse).text).not.toContain("else");
  });

  it("writes pass for an empty else", () => {
    const empty: ProjectProgram = {
      ...withElse,
      scripts: [
        {
          ...withElse.scripts[0]!,
          statements: [{ type: "if", condition: { type: "touchingGoal" }, then: [], else: [] }],
        },
      ],
    };
    expect(projectPython(empty).text).toMatch(/else:\n\s+pass/);
  });
});
