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
      statements: [
        {
          type: "waitUntil",
          condition: {
            type: "and",
            left: { type: "keyDown", key: "Space" },
            right: { type: "touchingGoal" },
          },
        },
      ],
    },
  ],
};

describe("waitUntil projections", () => {
  it("shows the same canonical condition and ten-second bound in all four views", () => {
    expect(projectAgorixCode(program).text).toMatch(/wait until .*up to 10 seconds/);
    expect(projectProgram(program).code).toMatch(/waitUntil\(\(\) => .*?, 10\)/);
    expect(projectPython(program).text).toMatch(/wait_until\(lambda: .*timeout=10\)/);
    expect(projectJava(program).text).toMatch(/waitUntil\(\(\) -> .*?, 10\)/);
  });
});
