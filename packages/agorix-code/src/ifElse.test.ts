import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import { projectAgorixCode } from "./index.js";
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
  it("Agorix Code", () => {
    const text = projectAgorixCode(withElse).text;
    expect(text).toContain("else\n");
    expect(text.indexOf("move")).toBeLessThan(text.indexOf("else"));
    expect(text.indexOf("else")).toBeLessThan(text.indexOf("turn"));
    expect(projectAgorixCode(withoutElse).text).not.toContain("else");
  });
});
