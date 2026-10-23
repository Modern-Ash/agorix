import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import { projectProgram } from "./project.js";

// Issue #466
const program: ProjectProgram = {
  schema: SCHEMA_VERSION,
  scripts: [
    {
      id: "main",
      trigger: { type: "onStart" },
      statements: [
        { type: "move", steps: 1 },
        { type: "wait", seconds: 1.5 },
      ],
    },
  ],
};

describe("wait projection (issue #466)", () => {
  it("is written between the surrounding statements", () => {
    const text = projectProgram(program).code;
    expect(text).toContain("wait(1.5);");
    expect(text.indexOf("wait(1.5);")).toBeGreaterThan(text.indexOf("move"));
  });
});
