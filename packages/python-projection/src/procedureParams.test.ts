import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import { projectPython } from "./index.js";

// Issue #538: custom block numbers in Python.
const program: ProjectProgram = {
  schema: SCHEMA_VERSION,
  variables: [{ id: "v", name: "total", initialValue: 0, visible: false }],
  scripts: [
    {
      id: "main",
      trigger: { type: "greenFlag" },
      statements: [
        {
          type: "callProcedure",
          procedureId: "proc-1-1",
          args: [
            { type: "numericLiteral", value: 120 },
            { type: "numericLiteral", value: 4 },
          ],
        },
        { type: "callProcedure", procedureId: "proc-1-2" },
      ],
      procedures: [
        {
          id: "proc-1-1",
          name: "Cuadrado",
          params: [
            { id: "p1", name: "lado" },
            { id: "p2", name: "veces" },
          ],
          body: [
            {
              type: "repeat",
              count: 4,
              countFrom: "p2",
              body: [
                { type: "move", steps: 40, stepsFrom: "p1" },
                { type: "turn", degrees: 90 },
                { type: "wait", seconds: 1, secondsFrom: "p1" },
              ],
            },
            {
              type: "setVariable",
              variableId: "v",
              value: {
                type: "add",
                left: { type: "param", paramId: "p1" },
                right: { type: "numericLiteral", value: 1 },
              },
            },
          ],
        },
        { id: "proc-1-2", name: "Paso", body: [{ type: "move", steps: 40 }] },
      ],
    },
  ],
};

describe("Python projection of custom block numbers", () => {
  it("declares the numbers, uses them in bound fields and passes them at the call", () => {
    const text = projectPython(program).text;
    for (const part of [
      "def my_cuadrado(n_lado, n_veces):",
      "for _ in range(round(n_veces)):",
      "move(n_lado)",
      "wait(n_lado)",
      "my_cuadrado(120, 4)",
    ])
      expect(text, part).toContain(part);
  });

  it("projects a block without numbers exactly as before", () => {
    const text = projectPython(program).text;
    expect(text).toContain("my_paso()");
  });
});
