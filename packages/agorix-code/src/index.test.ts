import { describe, expect, it } from "vitest";
import { assertLanguageProjectionConformance } from "@agorix/language-projection";
import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import { agorixCodeProjection, projectAgorixCode } from "./index.js";

const program: ProjectProgram = {
  schema: SCHEMA_VERSION,
  scripts: [
    {
      id: "main",
      trigger: { type: "onStart" },
      statements: [
        { type: "move", steps: 10 },
        { type: "turn", degrees: 90 },
        { type: "repeat", count: 2, body: [{ type: "move", steps: 5 }] },
        { type: "if", condition: { type: "touchingGoal" }, then: [{ type: "turn", degrees: 45 }] },
        { type: "if", condition: { type: "booleanLiteral", value: true }, then: [] },
        { type: "if", condition: { type: "numericLiteral", value: 1 }, then: [] },
      ],
    },
  ],
};

describe("Agorix Code projection", () => {
  it("projects every current canonical operation with visible nesting", () => {
    expect(projectAgorixCode(program).text).toBe(
      [
        "when start",
        "  move 10",
        "  turn 90",
        "  repeat 2 times",
        "    move 5",
        "  if touching goal",
        "    turn 45",
        "  if true",
        "  if 1",
        "",
      ].join("\n"),
    );
  });

  it("maps stable canonical statement ids to visible text", () => {
    const result = projectAgorixCode(program);
    for (const nodeId of [
      "scripts[0]",
      "scripts[0]/statements[0]",
      "scripts[0]/statements[2]",
      "scripts[0]/statements[2]/body[0]",
      "scripts[0]/statements[3]/then[0]",
    ]) {
      expect(result.mapping[nodeId]?.length).toBeGreaterThan(0);
    }
  });

  it("passes shared LanguageProjection conformance", () => {
    expect(() =>
      assertLanguageProjectionConformance(agorixCodeProjection, {
        name: "current POC operations",
        program,
        requiredNodeIds: [
          "scripts[0]",
          "scripts[0]/statements[0]",
          "scripts[0]/statements[1]",
          "scripts[0]/statements[2]",
          "scripts[0]/statements[3]",
        ],
      }),
    ).not.toThrow();
  });
});
