import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import { programToWorkspace, workspaceToProgram } from "./index.js";

describe("property of another actor block", () => {
  it("round-trips a built-in property and a declared variable", () => {
    const program: ProjectProgram = {
      schema: SCHEMA_VERSION,
      variables: [
        { id: "result", name: "result", initialValue: 0, visible: true },
        { id: "score", name: "score", initialValue: 0, visible: true },
      ],
      scripts: [
        {
          id: "main",
          trigger: { type: "onStart" },
          statements: [
            {
              type: "setVariable",
              variableId: "result",
              value: { type: "actorProperty", actorId: "actor:other", property: "xPosition" },
            },
            {
              type: "setVariable",
              variableId: "result",
              value: {
                type: "actorProperty",
                actorId: "actor:other",
                property: "variable",
                variableId: "score",
              },
            },
          ],
        },
      ],
    };
    expect(workspaceToProgram(programToWorkspace(program).workspace).program).toEqual(program);
  });
});
