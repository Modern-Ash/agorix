import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import { projectProgram } from "./project.js";

// Issue #735: a custom block hands its own number on to another block.
const PASS: ProjectProgram = {
  schema: SCHEMA_VERSION,
  scripts: [
    {
      id: "main",
      trigger: { type: "greenFlag" },
      statements: [
        {
          type: "callProcedure",
          procedureId: "proc-1-2",
          args: [{ type: "numericLiteral", value: 60 }],
        },
      ],
      procedures: [
        {
          id: "proc-1-1",
          name: "Avanzar",
          params: [{ id: "p1", name: "largo" }],
          body: [{ type: "move", steps: 20, stepsFrom: "p1" }],
        },
        {
          id: "proc-1-2",
          name: "Doble",
          params: [{ id: "p1", name: "base" }],
          body: [
            {
              type: "callProcedure",
              procedureId: "proc-1-1",
              args: [{ type: "param", paramId: "p1" }],
            },
          ],
        },
      ],
    },
  ],
};

describe("a number passed to another custom block", () => {
  it("is derived from the same program", () => {
    const text = projectProgram(PASS).code;
    expect(text).toMatch(/dobl[eo]|Doble|my_doble/i);
    expect(text).toContain("base");
  });
});
