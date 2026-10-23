import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import { projectPython } from "./index.js";

// Issue #464
const one = { type: "numericLiteral", value: 1 } as const;
const program: ProjectProgram = {
  schema: SCHEMA_VERSION,
  scripts: [
    {
      id: "main",
      trigger: { type: "onStart" },
      statements: [
        { type: "if", condition: { type: "lessOrEqual", left: one, right: one }, then: [] },
        { type: "if", condition: { type: "greaterOrEqual", left: one, right: one }, then: [] },
      ],
    },
  ],
};

describe("<= and >= projection (issue #464)", () => {
  it("writes both operators", () => {
    const text = projectPython(program).text;
    expect(text).toContain("(1 <= 1)");
    expect(text).toContain("(1 >= 1)");
  });
});
