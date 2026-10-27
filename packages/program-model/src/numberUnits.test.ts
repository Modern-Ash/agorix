import { describe, expect, it } from "vitest";
import { procedureNumberUnits } from "./numberUnits.js";
import type { Procedure } from "./schema.js";

function block(
  id: string,
  body: Procedure["body"],
  params: Procedure["params"] = [{ id: "p1", name: "Número" }],
): Procedure {
  return { id, name: "Bloque", params, body };
}

describe("custom block number units", () => {
  it("takes the unit from the first block that consumes the number", () => {
    const procedure = block("proc-1-1", [
      { type: "turn", degrees: 90, degreesFrom: "p1" },
      { type: "move", steps: 40, stepsFrom: "p1" },
    ]);
    expect(procedureNumberUnits(procedure)).toEqual(["degrees"]);
  });

  it("inherits the unit of the inner number it is handed on to", () => {
    const inner = block("proc-1-2", [{ type: "move", steps: 40, stepsFrom: "p1" }]);
    const outer = block("proc-1-1", [
      {
        type: "callProcedure",
        procedureId: "proc-1-2",
        args: [{ type: "param", paramId: "p1" }],
      },
    ]);
    expect(procedureNumberUnits(outer, [outer, inner])).toEqual(["steps"]);
    // Without the character's other blocks the target is unknown, so it stays a plain number.
    expect(procedureNumberUnits(outer)).toEqual(["number"]);
  });

  it("uses number for a title no block consumes, and returns one unit per title", () => {
    const procedure = block(
      "proc-1-1",
      [{ type: "say", text: "Hola" }],
      [
        { id: "p1", name: "Uno" },
        { id: "p2", name: "Dos" },
      ],
    );
    expect(procedureNumberUnits(procedure)).toEqual(["number", "number"]);
  });

  it("returns no units for a block without numbers", () => {
    expect(procedureNumberUnits(block("proc-1-1", [{ type: "turn", degrees: 90 }], []))).toEqual(
      [],
    );
  });
});
