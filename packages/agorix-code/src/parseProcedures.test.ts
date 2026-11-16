import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import { parseAgorixCode, projectAgorixCode } from "./index.js";

const program: ProjectProgram = {
  schema: SCHEMA_VERSION,
  sharedProcedures: [
    {
      id: "shared-1",
      name: "Hop",
      body: [{ type: "move", steps: 40 }],
    },
  ],
  scripts: [
    {
      id: "script-1",
      trigger: { type: "greenFlag" },
      procedures: [
        {
          id: "proc-1-1",
          name: "Draw side",
          params: [
            { id: "p1", name: "size" },
            { id: "p2", name: "turns" },
          ],
          body: [
            {
              type: "repeat",
              count: 3,
              countFrom: "p2",
              body: [
                { type: "move", steps: 40, stepsFrom: "p1" },
                { type: "turn", degrees: 90 },
              ],
            },
            { type: "wait", seconds: 1, secondsFrom: "p2" },
            { type: "callProcedure", procedureId: "shared-1" },
          ],
        },
        {
          id: "proc-1-2",
          name: "Twice",
          params: [{ id: "p1", name: "n" }],
          body: [
            {
              type: "callProcedure",
              procedureId: "proc-1-1",
              args: [
                { type: "param", paramId: "p1" },
                { type: "numericLiteral", value: 2 },
              ],
            },
          ],
        },
      ],
      statements: [
        {
          type: "callProcedure",
          procedureId: "proc-1-2",
          args: [{ type: "numericLiteral", value: 80 }],
        },
        { type: "callProcedure", procedureId: "shared-1" },
      ],
    },
  ],
};

describe("Agorix Code reads custom blocks", () => {
  it("gives the same program back, with and without the base", () => {
    const text = projectAgorixCode(program).text;
    for (const base of [program, undefined]) {
      expect(parseAgorixCode(text, base)).toEqual({ ok: true, program });
    }
  });

  it("refuses a call to a block nobody defined", () => {
    const text = projectAgorixCode(program).text.replace("call Twice with 80", "call Nope");
    expect(parseAgorixCode(text, undefined).ok).toBe(false);
  });
});
